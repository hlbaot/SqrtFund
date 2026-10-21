// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";
import {QFRound} from "../src/QFRound.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

contract RoundFactoryMultiOrganizerTest is Test {
    RoundFactory internal factory;
    StudentRegistry internal registry;
    MockUSDC internal token;
    address internal organizerA = address(0xA);
    address internal organizerB = address(0xB);
    address internal student = address(0xD);
    address internal projectOwner = address(0xE);
    uint256 internal startsAt;
    uint256 internal endsAt;

    event OrganizerUpdated(address indexed organizer, bool authorized);
    event RoundCreated(address indexed roundAddress, address indexed admin, address token, string name);

    function setUp() public {
        registry = new StudentRegistry(vm.addr(0xA771));
        factory = new RoundFactory(address(registry));
        token = new MockUSDC();
        startsAt = block.timestamp + 1 hours;
        endsAt = startsAt + 7 days;
    }

    function _create(address caller) internal returns (QFRound) {
        vm.prank(caller);
        return QFRound(factory.createRound("Campus", "Company", address(token), startsAt, endsAt, 1e6, 5e6, 3000, 10e6));
    }

    function _createPair() internal returns (QFRound a, QFRound b) {
        factory.setOrganizer(organizerA, true);
        factory.setOrganizer(organizerB, true);
        a = _create(organizerA);
        b = _create(organizerB);
    }

    function _deposit(QFRound round, address admin, uint256 amount) internal {
        token.mint(admin, amount);
        vm.startPrank(admin);
        token.approve(address(round), amount);
        round.depositPool(amount);
        vm.stopPrank();
    }

    // Chữ ký giả lập chỉ dùng trong EVM test; không cần backend hoặc khóa ví thật.
    function _verify(address wallet) internal {
        bytes32 email = keccak256(abi.encode(wallet));
        uint256 expiry = block.timestamp + 365 days;
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("SqrtFundStudentRegistry"),
                keccak256("1"),
                block.chainid,
                address(registry)
            )
        );
        bytes32 value = keccak256(abi.encode(registry.STUDENT_VERIFICATION_TYPEHASH(), wallet, email, expiry));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xA771, keccak256(abi.encodePacked("\x19\x01", domain, value)));
        vm.prank(wallet);
        registry.verifyStudent(email, expiry, abi.encodePacked(r, s, v));
    }

    function _project(QFRound round, address admin) internal returns (uint256 id) {
        vm.prank(projectOwner);
        id = round.registerProject("Project", "Description", "", "");
        vm.prank(admin);
        round.approveProject(id);
    }

    function test_OwnerCanCreateWithoutOrganizerGrant() public {
        assertEq(factory.owner(), address(this));
        assertFalse(factory.authorizedOrganizers(address(this)));
        QFRound round = _create(address(this));
        assertEq(round.admin(), address(this));
        assertEq(address(round.studentRegistry()), address(registry));
    }

    function test_GrantAndRevokeEmitEvents() public {
        vm.expectEmit(true, false, false, true, address(factory));
        emit OrganizerUpdated(organizerA, true);
        factory.setOrganizer(organizerA, true);
        assertTrue(factory.authorizedOrganizers(organizerA));
        vm.expectEmit(true, false, false, true, address(factory));
        emit OrganizerUpdated(organizerA, false);
        factory.setOrganizer(organizerA, false);
        assertFalse(factory.authorizedOrganizers(organizerA));
    }

    function test_ZeroAddressCannotBeGrantedOrRevoked() public {
        vm.expectRevert(bytes("Invalid address"));
        factory.setOrganizer(address(0), true);
        vm.expectRevert(bytes("Invalid address"));
        factory.setOrganizer(address(0), false);
    }

    function testFuzz_OnlyOwnerCanManageOrganizers(address caller, bool authorized) public {
        vm.assume(caller != address(this));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, caller));
        vm.prank(caller);
        factory.setOrganizer(organizerA, authorized);
        assertFalse(factory.authorizedOrganizers(organizerA));
    }

    function test_OrganizerCannotGrantItselfOrAnotherOrganizer() public {
        factory.setOrganizer(organizerA, true);
        vm.startPrank(organizerA);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, organizerA));
        factory.setOrganizer(organizerB, true);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, organizerA));
        factory.setOrganizer(organizerA, true);
        vm.stopPrank();
        assertFalse(factory.authorizedOrganizers(organizerB));
    }

    function testFuzz_UnauthorizedWalletCannotCreate(address caller) public {
        vm.assume(caller != address(this));
        vm.expectRevert(bytes("Not authorized"));
        _create(caller);
        assertEq(factory.roundCount(), 0);
    }

    function test_MultipleOrganizersCreateMultipleIndependentRounds() public {
        (QFRound a, QFRound b) = _createPair();
        QFRound anotherA = _create(organizerA);
        assertEq(a.admin(), organizerA);
        assertEq(b.admin(), organizerB);
        assertEq(anotherA.admin(), organizerA);
        assertTrue(address(a) != address(b) && address(a) != address(anotherA));
        address[] memory rounds = factory.getRounds();
        assertEq(factory.roundCount(), 3);
        assertEq(rounds.length, 3);
        assertEq(rounds[0], address(a));
        assertEq(rounds[1], address(b));
        assertEq(rounds[2], address(anotherA));
        _deposit(a, organizerA, 100e6);
        _deposit(b, organizerB, 200e6);
        assertEq(a.pool(), 100e6);
        assertEq(b.pool(), 200e6);
        assertEq(anotherA.pool(), 0);
        assertEq(token.balanceOf(address(a)), 100e6);
        assertEq(token.balanceOf(address(b)), 200e6);
    }

    function test_RoundCreatedEventRecordsOrganizerAsAdmin() public {
        factory.setOrganizer(organizerA, true);
        address expected = vm.computeCreateAddress(address(factory), vm.getNonce(address(factory)));
        vm.expectEmit(true, true, false, true, address(factory));
        emit RoundCreated(expected, organizerA, address(token), "Campus");
        assertEq(address(_create(organizerA)), expected);
    }

    function test_AdminAndPlatformOwnerCannotManageAnotherOrganizersRound() public {
        (QFRound a, QFRound b) = _createPair();
        _verify(projectOwner);
        vm.prank(projectOwner);
        uint256 id = b.registerProject("Project", "Description", "", "");
        vm.prank(organizerA);
        vm.expectRevert(QFRound.NotAdmin.selector);
        b.approveProject(id);
        vm.prank(organizerB);
        vm.expectRevert(QFRound.NotAdmin.selector);
        a.depositPool(1e6);
        // Quyền Platform Owner cũng không vượt qua onlyAdmin của QFRound.
        vm.expectRevert(QFRound.NotAdmin.selector);
        b.approveProject(id);
        vm.prank(organizerB);
        b.approveProject(id);
        assertEq(a.projectCount(), 0);
    }

    function test_RevokeBlocksCreationButPreservesExistingRoundAdmin() public {
        factory.setOrganizer(organizerA, true);
        QFRound a = _create(organizerA);
        factory.setOrganizer(organizerA, false);
        vm.expectRevert(bytes("Not authorized"));
        _create(organizerA);
        assertEq(factory.roundCount(), 1);
        assertEq(a.admin(), organizerA);
        _deposit(a, organizerA, 100e6);
        assertEq(a.pool(), 100e6);
        vm.prank(organizerA);
        a.cancelRound();
        assertTrue(a.isCancelled());
        vm.prank(organizerA);
        a.withdrawPoolIfCancelled();
        assertEq(token.balanceOf(organizerA), 100e6);
    }

    function test_RevokedOrganizerCanBeGrantedAgain() public {
        factory.setOrganizer(organizerA, true);
        _create(organizerA);
        factory.setOrganizer(organizerA, false);
        factory.setOrganizer(organizerA, true);
        _create(organizerA);
        assertEq(factory.roundCount(), 2);
    }

    function test_OwnershipTransferPreservesExistingOrganizerAndRoundPermissions() public {
        factory.setOrganizer(organizerA, true);
        QFRound a = _create(organizerA);
        factory.transferOwnership(organizerB);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, address(this)));
        factory.setOrganizer(organizerA, false);
        vm.expectRevert(bytes("Not authorized"));
        _create(address(this));
        QFRound b = _create(organizerB);
        assertEq(b.admin(), organizerB);
        assertEq(a.admin(), organizerA);
        assertTrue(factory.authorizedOrganizers(organizerA));
        vm.prank(organizerB);
        factory.setOrganizer(organizerA, false);
        assertFalse(factory.authorizedOrganizers(organizerA));
    }

    function test_InvalidCreationDoesNotChangeRegistryOrAuthorization() public {
        factory.setOrganizer(organizerA, true);
        vm.prank(organizerA);
        vm.expectRevert(QFRound.RoundNameInvalid.selector);
        factory.createRound("", "Company", address(token), startsAt, endsAt, 1e6, 5e6, 3000, 10e6);
        assertEq(factory.roundCount(), 0);
        assertTrue(factory.authorizedOrganizers(organizerA));
    }

    function test_StudentUsesTwoRoundsWithIndependentSettlement() public {
        (QFRound a, QFRound b) = _createPair();
        // Registry sinh viên được dùng chung; pool, donation và trạng thái vòng vẫn độc lập.
        _verify(projectOwner);
        _verify(student);
        _verify(address(0xD2));
        uint256 aId = _project(a, organizerA);
        uint256 bId = _project(b, organizerB);
        _deposit(a, organizerA, 100e6);
        _deposit(b, organizerB, 200e6);
        vm.warp(startsAt);
        address[2] memory donors = [student, address(0xD2)];
        for (uint256 i; i < donors.length; ++i) {
            token.mint(donors[i], 10e6);
            vm.startPrank(donors[i]);
            token.approve(address(a), 5e6);
            token.approve(address(b), 5e6);
            a.donate(aId, 2e6);
            b.donate(bId, 3e6);
            vm.stopPrank();
        }
        assertEq(a.spentInRound(student), 2e6);
        assertEq(b.spentInRound(student), 3e6);
        vm.warp(endsAt);
        vm.prank(organizerB);
        vm.expectRevert(QFRound.NotAdmin.selector);
        a.cancelRound();
        vm.prank(organizerA);
        a.finalize();
        assertFalse(b.finalized());
        vm.prank(projectOwner);
        a.claim(aId);
        assertEq(token.balanceOf(projectOwner), 4e6 + a.payoutOf(aId));
        vm.prank(organizerB);
        b.finalize();
        vm.prank(projectOwner);
        b.claim(bId);
        assertEq(token.balanceOf(projectOwner), 10e6 + a.payoutOf(aId) + b.payoutOf(bId));
        vm.prank(organizerA);
        a.withdrawLeftover();
        vm.prank(organizerB);
        b.withdrawLeftover();
        assertEq(token.balanceOf(address(a)), 0);
        assertEq(token.balanceOf(address(b)), 0);
    }
}
