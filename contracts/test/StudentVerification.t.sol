// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {QFRoundTest} from "./QFRound.t.sol";
import {QFRound} from "../src/QFRound.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";

contract StudentVerificationTest is QFRoundTest {
    uint256 private constant KEY = 0xA771;
    bytes32 private constant EMAIL = keccak256("student@hust.edu.vn");
    function signature(address student, bytes32 email, uint256 expiry, uint256 key, address target, string memory domainName) internal returns (bytes memory) {
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes(domainName)), keccak256("1"), block.chainid, target
        ));
        bytes32 value = keccak256(abi.encode(registry.STUDENT_VERIFICATION_TYPEHASH(), student, email, expiry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", domain, value)));
        return abi.encodePacked(r, s, v);
    }
    function proof(address student, uint256 expiry) internal returns (bytes memory) {
        return signature(student, EMAIL, expiry, KEY, address(registry), "SqrtFundStudentRegistry");
    }
    function verify(address student) internal {
        uint256 expiry = block.timestamp + 3600;
        bytes memory sig = proof(student, expiry);
        vm.prank(student); registry.verifyStudent(EMAIL, expiry, sig);
    }
    function test_GlobalStudentParticipatesInTwoRoundsWithoutAnotherOtp() public {
        verify(donor1);
        vm.prank(admin);
        QFRound second = QFRound(factory.createRound("Second", "Org", address(usdc), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound));
        assertTrue(registry.isStudent(donor1));
        assertTrue(round.isWhitelisted(donor1)); assertTrue(second.isWhitelisted(donor1));
        vm.prank(donor1); round.registerProject("First project", "Description", "", "");
        vm.prank(donor1); second.registerProject("Second project", "Description", "", "");
        uint256 project = _registerAndApproveProject(projectOwner1, "Donate target");
        _fundAndApprove(donor1, minDonation); vm.warp(startTime);
        vm.prank(donor1); round.donate(project, minDonation);
        assertEq(round.donationOf(donor1, project), minDonation);
    }
    function test_VerificationWithoutAnyFactoryOrRound() public {
        StudentRegistry standalone = new StudentRegistry(vm.addr(KEY));
        uint256 expiry = block.timestamp + 3600;
        bytes memory sig = signature(donor1, EMAIL, expiry, KEY, address(standalone), "SqrtFundStudentRegistry");
        vm.prank(donor1); standalone.verifyStudent(EMAIL, expiry, sig);
        assertTrue(standalone.isStudent(donor1));
    }
    function test_IdempotentReplay() public {
        uint256 expiry = block.timestamp + 3600; bytes memory sig = proof(donor1, expiry);
        vm.prank(donor1); registry.verifyStudent(EMAIL, expiry, sig);
        vm.prank(donor1); registry.verifyStudent(EMAIL, expiry, sig);
        assertTrue(registry.isStudent(donor1)); assertEq(registry.walletEmail(donor1), EMAIL);
    }
    function test_ExpiredSignature() public {
        uint256 expiry = block.timestamp + 1; bytes memory sig = proof(donor1, expiry); vm.warp(expiry + 1);
        vm.prank(donor1); vm.expectRevert(StudentRegistry.VerificationExpired.selector); registry.verifyStudent(EMAIL, expiry, sig);
    }
    function test_WrongSignerSenderRegistryChainAndLegacyDomain() public {
        uint256 expiry = block.timestamp + 3600;
        bytes memory sig = signature(donor1, EMAIL, expiry, KEY + 1, address(registry), "SqrtFundStudentRegistry");
        vm.prank(donor1); vm.expectRevert(StudentRegistry.InvalidAttestation.selector); registry.verifyStudent(EMAIL, expiry, sig);
        sig = proof(donor1, expiry);
        vm.prank(donor2); vm.expectRevert(StudentRegistry.InvalidAttestation.selector); registry.verifyStudent(EMAIL, expiry, sig);
        sig = signature(donor1, EMAIL, expiry, KEY, address(round), "SqrtFundStudentRegistry");
        vm.prank(donor1); vm.expectRevert(StudentRegistry.InvalidAttestation.selector); registry.verifyStudent(EMAIL, expiry, sig);
        sig = signature(donor1, EMAIL, expiry, KEY, address(registry), "SqrtFund");
        vm.prank(donor1); vm.expectRevert(StudentRegistry.InvalidAttestation.selector); registry.verifyStudent(EMAIL, expiry, sig);
        sig = proof(donor1, expiry); vm.chainId(block.chainid + 1);
        vm.prank(donor1); vm.expectRevert(StudentRegistry.InvalidAttestation.selector); registry.verifyStudent(EMAIL, expiry, sig);
    }
    function test_EmailAndWalletAreGloballyUnique() public {
        verify(donor1); uint256 expiry = block.timestamp + 3600; bytes memory sig = proof(donor2, expiry);
        vm.prank(donor2); vm.expectRevert(StudentRegistry.EmailAlreadyUsed.selector); registry.verifyStudent(EMAIL, expiry, sig);
        bytes32 another = keccak256("another@hust.edu.vn");
        sig = signature(donor1, another, expiry, KEY, address(registry), "SqrtFundStudentRegistry");
        vm.prank(donor1); vm.expectRevert(StudentRegistry.StudentAlreadyVerified.selector); registry.verifyStudent(another, expiry, sig);
    }
    function test_OnlyRegistryOwnerRotatesAttesterAndStudentsRemainVerified() public {
        verify(donor1);
        vm.prank(donor1); vm.expectRevert(); registry.setAttester(donor1);
        vm.prank(admin); vm.expectRevert(StudentRegistry.ZeroAddress.selector); registry.setAttester(address(0));
        vm.prank(admin); registry.setAttester(vm.addr(KEY + 1));
        assertTrue(round.isWhitelisted(donor1));
        uint256 expiry = block.timestamp + 3600; bytes memory sig = proof(donor2, expiry);
        vm.prank(donor2); vm.expectRevert(StudentRegistry.InvalidAttestation.selector); registry.verifyStudent(EMAIL, expiry, sig);
    }
    function test_UnverifiedCannotDonateOrRegister() public {
        uint256 p = _registerAndApproveProject(projectOwner1, "P"); vm.warp(startTime);
        vm.prank(donor2); vm.expectRevert(QFRound.NotStudent.selector); round.registerProject("P2", "Description", "", "");
        vm.prank(donor2); vm.expectRevert(QFRound.NotStudent.selector); round.donate(p, minDonation);
    }
    function test_SplitFiveUsdcAcrossFiveProjects() public {
        _verifyUser(donor1); _fundAndApprove(donor1, 5e6);
        for (uint160 i = 1; i <= 5; i++) {
            uint256 p = _registerAndApproveProject(address(0x9000 + i), "Project");
            vm.warp(startTime); vm.prank(donor1); round.donate(p, 1e6);
        }
        assertEq(round.spentInRound(donor1), 5e6); assertEq(round.remainingBudget(donor1), 5e6);
    }
    function test_ExactRoundCapAndOneWeiOver() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2");
        uint256 p3 = _registerAndApproveProject(address(0x33), "P3");
        _verifyUser(donor1); _fundAndApprove(donor1, 20e6); vm.warp(startTime);
        vm.prank(donor1); round.donate(p1, 5e6); vm.prank(donor1); round.donate(p2, 4e6);
        vm.prank(donor1); vm.expectRevert(QFRound.RoundBudgetExceeded.selector); round.donate(p3, 1e6 + 1);
        assertEq(round.spentInRound(donor1), 9e6);
        vm.prank(donor1); round.donate(p3, 1e6); assertEq(round.remainingBudget(donor1), 0);
        vm.prank(donor1); vm.expectRevert(QFRound.RoundBudgetExceeded.selector); round.donate(p3, 1e6);
    }
    function test_NewRoundResetsBudgetAndKeepsStudent() public {
        _verifyUser(donor1); uint256 p = _registerAndApproveProject(projectOwner1, "P");
        _fundAndApprove(donor1, 5e6); vm.warp(startTime); vm.prank(donor1); round.donate(p, 5e6);
        vm.prank(admin); QFRound second = QFRound(factory.createRound("Next", "Org", address(usdc), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound));
        assertEq(second.spentInRound(donor1), 0); assertEq(second.remainingBudget(donor1), maxPerRound);
        assertTrue(second.isWhitelisted(donor1));
    }
    function test_InvalidBudgetRejected() public {
        vm.prank(admin); vm.expectRevert(QFRound.InvalidRoundBudget.selector);
        factory.createRound("Bad", "Org", address(usdc), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxDonation - 1);
    }
    function testFuzz_SpentAndPayoutBound(uint96 donationSeed, uint96 poolSeed) public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2");
        _verifyUser(donor1); _verifyUser(donor2); _fundAndApprove(donor1, 10e6); _fundAndApprove(donor2, 5e6); vm.warp(startTime);
        uint256 a = bound(uint256(donationSeed), 1e6, 5e6);
        uint256 b = bound(uint256(donationSeed) / 7, 1e6, 5e6);
        vm.prank(donor1); round.donate(p1, a); vm.prank(donor1); round.donate(p2, b);
        vm.prank(donor2); round.donate(p1, 1e6);
        assertLe(round.spentInRound(donor1), maxPerRound); assertEq(round.spentInRound(donor1), a + b);
        uint256 matchingPool = bound(uint256(poolSeed), 1, 1_000_000e6);
        _fundAndApprove(admin, matchingPool); vm.prank(admin); round.depositPool(matchingPool);
        vm.warp(endTime); vm.prank(admin); round.finalize();
        assertLe(round.payoutOf(p1) + round.payoutOf(p2), matchingPool);
    }
}
