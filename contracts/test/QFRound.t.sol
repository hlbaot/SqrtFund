// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {QFRound} from "../src/QFRound.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

contract QFRoundTest is Test {
    MockUSDC public usdc;
    RoundFactory public factory;
    QFRound public round;
    StudentRegistry public registry;

    address public admin = address(0xAA);
    address public sponsor = address(0xBB);
    address public projectOwner1 = address(0x11);
    address public projectOwner2 = address(0x22);
    address public donor1 = address(0xD1);
    address public donor2 = address(0xD2);

    uint256 public startTime;
    uint256 public endTime;
    uint256 public minDonation = 1 * 10 ** 6; // 1 USDC
    uint256 public maxPerRound = 10 * 10 ** 6;
    uint256 public maxDonation = 5 * 10 ** 6; // 5 USDC
    uint256 public maxMatchBps = 3000; // 30%

    function setUp() public {
        startTime = block.timestamp + 1 hours;
        endTime = startTime + 7 days;

        usdc = new MockUSDC();
        vm.prank(admin);
        registry = new StudentRegistry(vm.addr(0xA771));
        vm.prank(admin);
        factory = new RoundFactory(address(registry));

        vm.prank(admin);
        address roundAddr = factory.createRound(
            "Test Round",
            "Test Organizer",
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps
        , maxPerRound);
        round = QFRound(roundAddr);
    }

    // --- Helper Utilities ---

    function _verifyUser(address user) internal {
        if (registry.isStudent(user)) return;
        bytes32 email = keccak256(abi.encode(user));
        uint256 expiry = block.timestamp + 365 days;
        bytes32 domain = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("SqrtFundStudentRegistry"), keccak256("1"), block.chainid, address(registry)
        ));
        bytes32 value = keccak256(abi.encode(registry.STUDENT_VERIFICATION_TYPEHASH(), user, email, expiry));
        (uint8 v, bytes32 r, bytes32 sigS) = vm.sign(0xA771, keccak256(abi.encodePacked("\x19\x01", domain, value)));
        vm.prank(user); registry.verifyStudent(email, expiry, abi.encodePacked(r, sigS, v));
    }

    function _registerAndApproveProject(address owner, string memory name) internal returns (uint256 pId) {
        _verifyUser(owner);
        vm.prank(owner);
        pId = round.registerProject(name, "Project Description", "https://img.png", "https://project.org");
        vm.prank(admin);
        round.approveProject(pId);
    }

    function _fundAndApprove(address user, uint256 amount) internal {
        deal(address(usdc), user, amount);
        vm.prank(user);
        usdc.approve(address(round), amount);
    }

    // --- MockUSDC Tests ---

    function test_MockUSDC_faucet() public {
        address user = address(0x999);
        vm.prank(user);
        usdc.faucetMint();
        assertEq(usdc.balanceOf(user), 100 * 10 ** 6);

        // Immediate second mint should revert due to cooldown
        vm.prank(user);
        vm.expectRevert();
        usdc.faucetMint();

        // Warp 1 hour: can mint again
        vm.warp(block.timestamp + 1 hours);
        vm.prank(user);
        usdc.faucetMint();
        assertEq(usdc.balanceOf(user), 200 * 10 ** 6);

        // Advance and hit lifetime cap (1,000 USDC = 10 mints total)
        for (uint256 i = 2; i < 10; i++) {
            vm.warp(block.timestamp + 1 hours);
            vm.prank(user);
            usdc.faucetMint();
        }
        assertEq(usdc.balanceOf(user), 1000 * 10 ** 6);

        // 11th mint should exceed lifetime cap
        vm.warp(block.timestamp + 1 hours);
        vm.prank(user);
        vm.expectRevert(MockUSDC.FaucetCapExceeded.selector);
        usdc.faucetMint();
    }

    // --- Core QF Math Verification ---

    function test_Math_300x1_beats_60x5() public {
        // Project 1: 300 donors x 1 USDC
        // Project 2: 60 donors x 5 USDC
        // Both projects receive 300 USDC direct donations.
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1 300x1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2 60x5");

        vm.warp(startTime + 1);

        for (uint160 i = 1; i <= 300; i++) {
            address d = address(uint160(0x1000 + i));
            _verifyUser(d);
            _fundAndApprove(d, 1 * 10 ** 6);
            vm.prank(d);
            round.donate(p1, 1 * 10 ** 6);
        }

        for (uint160 i = 1; i <= 60; i++) {
            address d = address(uint160(0x2000 + i));
            _verifyUser(d);
            _fundAndApprove(d, 5 * 10 ** 6);
            vm.prank(d);
            round.donate(p2, 5 * 10 ** 6);
        }

        // Sponsor deposits large pool (e.g., 200,000 USDC) so cap / pool size does not truncate raw comparison
        uint256 largePool = 200_000 * 10 ** 6;
        _fundAndApprove(admin, largePool);
        vm.prank(admin);
        round.depositPool(largePool);

        (uint256[] memory ids, uint256[] memory estimated) = round.previewMatching();
        assertEq(ids.length, 2);

        // Project 1 raw: ~89,700 USDC (89,700 * 10^6)
        // Project 2 raw: ~17,700 USDC (17,700 * 10^6)
        // Note: cap is maxMatchBps = 30% of pool = 60,000 USDC.
        // To inspect pure raw before cap, let's test preview when maxMatchBps is 100% or observe raw:
        // P1 should be strictly greater than P2.
        assertGt(estimated[0], estimated[1]);
        assertApproxEqAbs(estimated[0], 60_000 * 10 ** 6, 1); // Capped at 30% of 200k = 60k
        assertApproxEqAbs(estimated[1], 17_700 * 10 ** 6, 50 * 10 ** 6); // ~17,700 USDC
    }

    function test_Math_SingleDonor_YieldsZeroMatching_And_Incremental1plus1plus1() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "Single Donor");
        vm.warp(startTime + 1);

        _verifyUser(donor1);
        _fundAndApprove(donor1, 3 * 10 ** 6);

        // Donor gives 1 + 1 + 1 to the same project
        vm.prank(donor1);
        round.donate(p1, 1 * 10 ** 6);
        vm.prank(donor1);
        round.donate(p1, 1 * 10 ** 6);
        vm.prank(donor1);
        round.donate(p1, 1 * 10 ** 6);

        // Sponsor deposits pool
        _fundAndApprove(admin, 10_000 * 10 ** 6);
        vm.prank(admin);
        round.depositPool(10_000 * 10 ** 6);

        (, uint256[] memory estimated) = round.previewMatching();
        // Since there is only 1 donor, raw_p = max(0, S_p^2 / SCALE - totalDonated)
        // S = sqrt(3 * 10^6 * 10^12) = sqrt(3 * 10^18) = 1,732,050,807
        // S^2 / 10^12 = 2,999,999 <= totalDonated (3,000,000)
        // Raw matching MUST be 0!
        assertEq(estimated[0], 0);
    }

    function test_DonationLimits_PerProject_And_MultipleProjects() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "Project 1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "Project 2");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _fundAndApprove(donor1, 15 * 10 ** 6);

        // Giving 3 USDC
        vm.prank(donor1);
        round.donate(p1, 3 * 10 ** 6);

        // Giving 3 USDC again to p1 should revert (3 + 3 = 6 > maxDonation of 5)
        vm.prank(donor1);
        vm.expectRevert(QFRound.DonationExceedsMax.selector);
        round.donate(p1, 3 * 10 ** 6);

        // Can give 2 more to p1 (total = 5)
        vm.prank(donor1);
        round.donate(p1, 2 * 10 ** 6);
        assertEq(round.donationOf(donor1, p1), 5 * 10 ** 6);

        // And can also give 5 USDC to p2!
        vm.prank(donor1);
        round.donate(p2, 5 * 10 ** 6);
        assertEq(round.donationOf(donor1, p2), 5 * 10 ** 6);
    }

    // --- Pool Allocation Scenarios ---

    function test_PoolSmallerThanTotalRaw_ProportionalPayout() public {
        // Deploy a round with maxMatchBps = 10000 so the per-project cap does not leave artificial leftover
        vm.prank(admin);
        address rAddr = factory.createRound(
            "Uncapped Round",
            "Test Org",
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            10000
        , maxPerRound);
        QFRound uncapRound = QFRound(rAddr);

        _verifyUser(projectOwner1);
        _verifyUser(projectOwner2);

        vm.prank(projectOwner1);
        uint256 p1 = uncapRound.registerProject("P1", "Desc", "url", "url");
        vm.prank(projectOwner2);
        uint256 p2 = uncapRound.registerProject("P2", "Desc", "url", "url");
        vm.prank(admin);
        uncapRound.approveProject(p1);
        vm.prank(admin);
        uncapRound.approveProject(p2);

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _verifyUser(donor2);

        _fundAndApprove(donor1, 10 * 10 ** 6);
        _fundAndApprove(donor2, 10 * 10 ** 6);

        // Approve uncapRound
        vm.prank(donor1);
        usdc.approve(address(uncapRound), 10 * 10 ** 6);
        vm.prank(donor2);
        usdc.approve(address(uncapRound), 10 * 10 ** 6);

        // 2 donors on each project to generate positive raw matching
        vm.prank(donor1);
        uncapRound.donate(p1, 2 * 10 ** 6);
        vm.prank(donor2);
        uncapRound.donate(p1, 2 * 10 ** 6);

        vm.prank(donor1);
        uncapRound.donate(p2, 1 * 10 ** 6);
        vm.prank(donor2);
        uncapRound.donate(p2, 1 * 10 ** 6);

        // Total pool is small (e.g. 2 USDC = 2,000,000)
        uint256 smallPool = 2 * 10 ** 6;
        _fundAndApprove(admin, smallPool);
        vm.prank(admin);
        usdc.approve(address(uncapRound), smallPool);
        vm.prank(admin);
        uncapRound.depositPool(smallPool);

        vm.warp(endTime + 1);
        vm.prank(admin);
        uncapRound.finalize();

        uint256 payout1 = uncapRound.payoutOf(p1);
        uint256 payout2 = uncapRound.payoutOf(p2);
        uint256 leftover = uncapRound.leftover();

        assertLe(payout1 + payout2, smallPool);
        assertEq(payout1 + payout2 + leftover, smallPool);
        // Dust left over due to integer division is at most number of projects (2 wei)
        assertLe(leftover, 2);
    }

    function test_MatchingCapEnforced() public {
        // In default round, maxMatchBps = 3000 (30%)
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _verifyUser(donor2);
        _fundAndApprove(donor1, 5 * 10 ** 6);
        _fundAndApprove(donor2, 5 * 10 ** 6);

        vm.prank(donor1);
        round.donate(p1, 5 * 10 ** 6);
        vm.prank(donor2);
        round.donate(p1, 5 * 10 ** 6);

        // Pool = 10 USDC. Cap = 30% of 10 USDC = 3 USDC.
        // Raw matching for p1 would be (2 * sqrt(5e18))^2 / 1e12 - 10e6 = 20e6 - 10e6 = 10 USDC.
        uint256 testPool = 10 * 10 ** 6;
        _fundAndApprove(admin, testPool);
        vm.prank(admin);
        round.depositPool(testPool);

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();

        uint256 payout1 = round.payoutOf(p1);
        assertEq(payout1, 3 * 10 ** 6); // Exactly capped at 30%
        assertEq(round.leftover(), 7 * 10 ** 6);
    }

    function test_PoolLargerThanTotalRaw_LeftoverAndWithdraw() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _verifyUser(donor2);
        _fundAndApprove(donor1, 1 * 10 ** 6);
        _fundAndApprove(donor2, 1 * 10 ** 6);

        vm.prank(donor1);
        round.donate(p1, 1 * 10 ** 6);
        vm.prank(donor2);
        round.donate(p1, 1 * 10 ** 6);

        // Raw matching for p1: (2 * sqrt(1e18))^2 / 1e12 - 2e6 = 4e6 - 2e6 = 2e6 (2 USDC)
        uint256 largePool = 100 * 10 ** 6; // 100 USDC
        _fundAndApprove(admin, largePool);
        vm.prank(admin);
        round.depositPool(largePool);

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();

        uint256 payout = round.payoutOf(p1);
        assertEq(payout, 2 * 10 ** 6);
        assertEq(round.leftover(), 98 * 10 ** 6);

        // Admin withdraws leftover
        uint256 adminBalBefore = usdc.balanceOf(admin);
        vm.prank(admin);
        round.withdrawLeftover();
        assertEq(usdc.balanceOf(admin) - adminBalBefore, 98 * 10 ** 6);

        // Reverts if called a second time
        vm.prank(admin);
        vm.expectRevert(QFRound.LeftoverAlreadyWithdrawn.selector);
        round.withdrawLeftover();
    }

    function test_PreviewMatchingEqualsFinalize() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _verifyUser(donor2);
        _fundAndApprove(donor1, 5 * 10 ** 6);
        _fundAndApprove(donor2, 5 * 10 ** 6);

        vm.prank(donor1);
        round.donate(p1, 3 * 10 ** 6);
        vm.prank(donor2);
        round.donate(p1, 2 * 10 ** 6);
        vm.prank(donor1);
        round.donate(p2, 1 * 10 ** 6);

        _fundAndApprove(admin, 10 * 10 ** 6);
        vm.prank(admin);
        round.depositPool(10 * 10 ** 6);

        (uint256[] memory ids, uint256[] memory previewPayouts) = round.previewMatching();

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();

        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(previewPayouts[i], round.payoutOf(ids[i]));
        }
    }

    // --- Whitelist & Verification Flow ---







    // --- Batch Whitelist ---



    // --- Claim Flow ---

    function test_ClaimFlow() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "Project 1");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _fundAndApprove(donor1, 5 * 10 ** 6);
        vm.prank(donor1);
        round.donate(p1, 5 * 10 ** 6);

        _fundAndApprove(admin, 10 * 10 ** 6);
        vm.prank(admin);
        round.depositPool(10 * 10 ** 6);

        // Claim before finalize reverts
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.NotFinalized.selector);
        round.claim(p1);

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();

        // Claim by non-owner reverts
        vm.prank(donor1);
        vm.expectRevert(QFRound.NotProjectOwner.selector);
        round.claim(p1);

        // Owner claims successfully
        uint256 balBefore = usdc.balanceOf(projectOwner1);
        vm.prank(projectOwner1);
        round.claim(p1);
        assertGt(usdc.balanceOf(projectOwner1), balBefore);

        // Duplicate claim reverts
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.AlreadyClaimed.selector);
        round.claim(p1);
    }

    // --- All Negative & Revert Scenarios ---

    function test_Reverts() public {
        // Owner donating to own project reverts
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        _verifyUser(projectOwner1);
        _fundAndApprove(projectOwner1, 2 * 10 ** 6);
        vm.warp(startTime + 1);
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.SelfDonationNotAllowed.selector);
        round.donate(p1, 2 * 10 ** 6);

        // Non-whitelisted donate reverts
        _fundAndApprove(donor1, 2 * 10 ** 6);
        vm.prank(donor1);
        vm.expectRevert(QFRound.NotStudent.selector);
        round.donate(p1, 2 * 10 ** 6);

        // Donate to unapproved project reverts
        _verifyUser(projectOwner2);
        vm.prank(projectOwner2);
        uint256 unapprovedP = round.registerProject("Unapproved", "Desc", "url", "url");
        _verifyUser(donor1);
        vm.prank(donor1);
        vm.expectRevert(QFRound.ProjectNotApproved.selector);
        round.donate(unapprovedP, 2 * 10 ** 6);

        // Donate below min reverts
        vm.prank(donor1);
        vm.expectRevert(QFRound.DonationBelowMin.selector);
        round.donate(p1, 0.5 * 10 ** 6);

        // Donate outside time window reverts
        vm.warp(startTime - 1);
        vm.prank(donor1);
        vm.expectRevert(QFRound.RoundNotActive.selector);
        round.donate(p1, 1 * 10 ** 6);

        vm.warp(endTime + 1);
        vm.prank(donor1);
        vm.expectRevert(QFRound.RoundNotActive.selector);
        round.donate(p1, 1 * 10 ** 6);

        // Finalize before endTime reverts
        vm.warp(endTime - 1);
        vm.expectRevert(QFRound.RoundNotEnded.selector);
        round.finalize();

        // Finalize twice reverts
        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();
        vm.prank(admin);
        vm.expectRevert(QFRound.AlreadyFinalized.selector);
        round.finalize();

        // Non-admin calling admin functions reverts
        vm.prank(donor1);
        vm.expectRevert(QFRound.NotAdmin.selector);
        round.depositPool(100);

        vm.prank(donor1);
        vm.expectRevert(QFRound.NotAdmin.selector);
        round.withdrawLeftover();
    }

    // --- Boundary Tests (Max Projects & Max Requesters) ---

    function test_MaxProjectsBoundary() public {
        for (uint160 i = 0; i < 25; i++) {
            address owner = address(0xC000 + i);
            _verifyUser(owner);
            vm.startPrank(owner);
            round.registerProject("Project", "Desc", "https://img", "https://site");
            round.registerProject("Project", "Desc", "https://img", "https://site");
            vm.stopPrank();
        }
        _verifyUser(address(this));
        assertEq(round.projectCount(), 50);

        // 51st project reverts
        vm.expectRevert(QFRound.MaxProjectsReached.selector);
        round.registerProject("51st", "Desc", "https://img", "https://site");
    }



    // --- Accounting Invariant Test ---

    function test_AccountingDustBound() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _verifyUser(donor2);
        _fundAndApprove(donor1, 10 * 10 ** 6);
        _fundAndApprove(donor2, 10 * 10 ** 6);

        vm.prank(donor1);
        round.donate(p1, 3 * 10 ** 6);
        vm.prank(donor2);
        round.donate(p1, 2 * 10 ** 6);
        vm.prank(donor1);
        round.donate(p2, 1 * 10 ** 6);
        vm.prank(donor2);
        round.donate(p2, 4 * 10 ** 6);

        _fundAndApprove(admin, 7 * 10 ** 6);
        vm.prank(admin);
        round.depositPool(7 * 10 ** 6);

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();

        vm.prank(projectOwner1);
        round.claim(p1);
        vm.prank(projectOwner2);
        round.claim(p2);

        vm.prank(admin);
        round.withdrawLeftover();

        // Contract balance must be <= number of projects in wei (dust bound)
        assertLe(usdc.balanceOf(address(round)), 2);
    }

    // --- Fuzz Testing Invariant ---

    function testFuzz_PayoutsNeverExceedPool(uint256 poolDeposit, uint256 don1, uint256 don2) public {
        poolDeposit = bound(poolDeposit, 1 * 10 ** 6, 1_000_000 * 10 ** 6);
        don1 = bound(don1, minDonation, maxDonation);
        don2 = bound(don2, minDonation, maxDonation);

        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2");

        vm.warp(startTime + 1);
        _verifyUser(donor1);
        _verifyUser(donor2);
        _fundAndApprove(donor1, don1 + don2);
        _fundAndApprove(donor2, don1 + don2);

        vm.prank(donor1);
        round.donate(p1, don1);
        vm.prank(donor2);
        round.donate(p1, don2);

        _fundAndApprove(admin, poolDeposit);
        vm.prank(admin);
        round.depositPool(poolDeposit);

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();

        uint256 pay1 = round.payoutOf(p1);
        uint256 pay2 = round.payoutOf(p2);
        uint256 leftover = round.leftover();

        assertLe(pay1 + pay2, poolDeposit);
        assertEq(pay1 + pay2 + leftover, poolDeposit);

        // Claims and withdraw should succeed
        vm.prank(projectOwner1);
        round.claim(p1);
        vm.prank(projectOwner2);
        round.claim(p2);
        vm.prank(admin);
        round.withdrawLeftover();

        // Balance remains below dust bound
        assertLe(usdc.balanceOf(address(round)), 2);
    }

    // --- New Tests for Requested Requirements ---

    function test_Finalize_GracePeriod_AdminCanFinalize_NonAdminReverts() public {
        _registerAndApproveProject(projectOwner1, "P1");
        vm.warp(endTime + 1 hours);

        // Non-admin trying to finalize during grace period (first 24h) reverts
        address stranger = address(0x999);
        vm.prank(stranger);
        vm.expectRevert(QFRound.FinalizeGracePeriodActive.selector);
        round.finalize();

        // Admin can finalize during grace period
        vm.prank(admin);
        round.finalize();
        assertTrue(round.finalized());
    }

    function test_Finalize_AnyoneCanFinalizeAfterGrace() public {
        _registerAndApproveProject(projectOwner1, "P1");
        // Warp past grace period (1 days after endTime)
        vm.warp(endTime + 1 days + 1 seconds);

        address stranger = address(0x999);
        vm.prank(stranger);
        round.finalize();
        assertTrue(round.finalized());
    }

    function test_Finalize_StrangerCannotLockRoundWithPoolZeroBeforeGrace() public {
        _registerAndApproveProject(projectOwner1, "P1");
        vm.warp(endTime + 10 minutes);

        // Pool is currently 0, stranger attempts to lock the round prematurely
        address stranger = address(0x999);
        vm.prank(stranger);
        vm.expectRevert(QFRound.FinalizeGracePeriodActive.selector);
        round.finalize();

        // Admin can still deposit pool and finalize properly
        _fundAndApprove(admin, 5_000 * 10 ** 6);
        vm.prank(admin);
        round.depositPool(5_000 * 10 ** 6);

        vm.prank(admin);
        round.finalize();
        assertTrue(round.finalized());
        assertEq(round.pool(), 5_000 * 10 ** 6);
    }

    function test_ApproveProject_RevertsAfterEndTimeOrFinalize() public {
        _verifyUser(projectOwner1);
        vm.prank(projectOwner1);
        uint256 p1 = round.registerProject("P1", "Desc", "url", "url");

        // Warp past endTime
        vm.warp(endTime + 1);
        vm.prank(admin);
        vm.expectRevert(QFRound.RoundEnded.selector);
        round.approveProject(p1);

        // Also test after finalize
        vm.prank(admin);
        round.finalize();

        vm.prank(admin);
        vm.expectRevert(QFRound.AlreadyFinalized.selector);
        round.approveProject(p1);
    }

    function test_DepositPool_ZeroAmountReverts() public {
        vm.prank(admin);
        vm.expectRevert(QFRound.ZeroAmount.selector);
        round.depositPool(0);
    }

    function test_RegisterProject_UnverifiedReverts() public {
        address unverified = address(0x789);
        assertFalse(round.isWhitelisted(unverified));

        vm.prank(unverified);
        vm.expectRevert(QFRound.NotStudent.selector);
        round.registerProject("P", "Desc", "https://img", "https://url");
    }

    function test_RoundFactory_UnauthorizedCannotCreateAndRoundCountWithSeveralRounds() public {
        address stranger = address(0x123);
        vm.prank(stranger);
        vm.expectRevert();
        factory.createRound("R1", "Org1", address(usdc), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound);

        // Admin creates round 2 and round 3
        vm.prank(admin);
        address r2 = factory.createRound("R2", "Org2", address(usdc), startTime + 10 days, endTime + 10 days, minDonation, maxDonation, maxMatchBps, maxPerRound);
        vm.prank(admin);
        address r3 = factory.createRound("R3", "Org3", address(usdc), startTime + 20 days, endTime + 20 days, minDonation, maxDonation, maxMatchBps, maxPerRound);

        assertEq(factory.roundCount(), 3);
        address[] memory all = factory.getRounds();
        assertEq(all.length, 3);
        assertEq(all[1], r2);
        assertEq(all[2], r3);
    }

    function test_QFRound_ConstructorValidation() public {
        // endTime <= startTime
        vm.expectRevert(QFRound.InvalidTimeRange.selector);
        new QFRound("Round 1", "Org 1", admin, address(usdc), endTime, startTime, minDonation, maxDonation, maxMatchBps, maxPerRound, address(registry));

        // minDonation == 0
        vm.expectRevert(QFRound.InvalidDonationBounds.selector);
        new QFRound("Round 1", "Org 1", admin, address(usdc), startTime, endTime, 0, maxDonation, maxMatchBps, maxPerRound, address(registry));

        // minDonation > maxDonation
        vm.expectRevert(QFRound.InvalidDonationBounds.selector);
        new QFRound("Round 1", "Org 1", admin, address(usdc), startTime, endTime, 10 * 10 ** 6, 5 * 10 ** 6, maxMatchBps, maxPerRound, address(registry));

        // maxMatchBps > 10000
        vm.expectRevert(QFRound.InvalidMaxMatchBps.selector);
        new QFRound("Round 1", "Org 1", admin, address(usdc), startTime, endTime, minDonation, maxDonation, 10001, maxPerRound, address(registry));

        // zero address admin
        vm.expectRevert(QFRound.ZeroAddress.selector);
        new QFRound("Round 1", "Org 1", address(0), address(usdc), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound, address(registry));

        // zero address token
        vm.expectRevert(QFRound.ZeroAddress.selector);
        new QFRound("Round 1", "Org 1", admin, address(0), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound, address(registry));
    }

    function test_QFRound_NameAndOrganizerValidation() public {
        // Valid name and organizer
        QFRound rValid = new QFRound(
            "Valid Round Name",
            "Valid Organizer",
            admin,
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps, maxPerRound,
            address(registry)
        );
        assertEq(rValid.name(), "Valid Round Name");
        assertEq(rValid.organizer(), "Valid Organizer");

        // Organizer can be empty (0 bytes)
        QFRound rEmptyOrg = new QFRound(
            "Round With No Org",
            "",
            admin,
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps, maxPerRound,
            address(registry)
        );
        assertEq(rEmptyOrg.name(), "Round With No Org");
        assertEq(rEmptyOrg.organizer(), "");

        // Empty name reverts
        vm.expectRevert(QFRound.RoundNameInvalid.selector);
        new QFRound(
            "",
            "Valid Organizer",
            admin,
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps, maxPerRound,
            address(registry)
        );

        // Name too long (> 60 bytes) reverts
        string memory longName = "1234567890123456789012345678901234567890123456789012345678901"; // 61 bytes
        vm.expectRevert(QFRound.RoundNameInvalid.selector);
        new QFRound(
            longName,
            "Valid Organizer",
            admin,
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps, maxPerRound,
            address(registry)
        );

        // Organizer too long (> 60 bytes) reverts
        string memory longOrg = "1234567890123456789012345678901234567890123456789012345678901"; // 61 bytes
        vm.expectRevert(QFRound.OrganizerTooLong.selector);
        new QFRound(
            "Valid Round",
            longOrg,
            admin,
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps, maxPerRound,
            address(registry)
        );
    }

    function test_RegisterProject_LengthLimits() public {
        _verifyUser(projectOwner1);

        // Name empty
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.NameLengthInvalid.selector);
        round.registerProject("", "Valid description", "https://img", "https://url");

        // Name > 60 bytes
        string memory longName = "1234567890123456789012345678901234567890123456789012345678901"; // 61 chars
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.NameLengthInvalid.selector);
        round.registerProject(longName, "Valid description", "https://img", "https://url");

        // Description empty
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.DescriptionLengthInvalid.selector);
        round.registerProject("Valid name", "", "https://img", "https://url");

        // Description > 280 bytes
        bytes memory longDescBytes = new bytes(281);
        for (uint256 i = 0; i < 281; i++) longDescBytes[i] = "a";
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.DescriptionLengthInvalid.selector);
        round.registerProject("Valid name", string(longDescBytes), "https://img", "https://url");

        // ImageUrl > 200 bytes
        bytes memory longUrlBytes = new bytes(201);
        for (uint256 i = 0; i < 201; i++) longUrlBytes[i] = "u";
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.UrlTooLong.selector);
        round.registerProject("Valid name", "Valid description", string(longUrlBytes), "https://url");

        // Link > 200 bytes
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.UrlTooLong.selector);
        round.registerProject("Valid name", "Valid description", "https://img", string(longUrlBytes));
    }



    function test_Finalize_ZeroApprovedProjectsAndZeroPool() public {
        // Round with 0 approved projects and 0 pool
        vm.warp(endTime + 1 days + 1);
        round.finalize();
        assertTrue(round.finalized());
        assertEq(round.pool(), 0);
        assertEq(round.leftover(), 0);

        // Test with pool > 0 and 0 approved projects
        vm.prank(admin);
        address rAddr = factory.createRound("Empty Round", "Org", address(usdc), startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound);
        QFRound r2 = QFRound(rAddr);

        deal(address(usdc), admin, 100 * 10 ** 6);
        vm.prank(admin);
        usdc.approve(address(r2), 100 * 10 ** 6);
        vm.prank(admin);
        r2.depositPool(100 * 10 ** 6);

        vm.warp(endTime + 1 days + 1);
        r2.finalize();
        assertTrue(r2.finalized());
        assertEq(r2.leftover(), 100 * 10 ** 6);

        // Admin withdraws entire leftover
        uint256 balBefore = usdc.balanceOf(admin);
        vm.prank(admin);
        r2.withdrawLeftover();
        assertEq(usdc.balanceOf(admin) - balBefore, 100 * 10 ** 6);
    }

    function test_Math_300x1_beats_60x5_Uncapped() public {
        // Deploy round with maxMatchBps = 10000 (100% cap)
        vm.prank(admin);
        address rAddr = factory.createRound(
            "Math Round",
            "Org",
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            10000
        , maxPerRound);
        QFRound uncapRound = QFRound(rAddr);

        _verifyUser(projectOwner1);
        _verifyUser(projectOwner2);

        vm.prank(projectOwner1);
        uint256 p1 = uncapRound.registerProject("P1 300x1", "Desc", "url", "url");
        vm.prank(projectOwner2);
        uint256 p2 = uncapRound.registerProject("P2 60x5", "Desc", "url", "url");

        vm.prank(admin);
        uncapRound.approveProject(p1);
        vm.prank(admin);
        uncapRound.approveProject(p2);

        vm.warp(startTime + 1);

        for (uint160 i = 1; i <= 300; i++) {
            address d = address(uint160(0x3000 + i));
            _verifyUser(d);
            deal(address(usdc), d, 1 * 10 ** 6);
            vm.prank(d);
            usdc.approve(address(uncapRound), 1 * 10 ** 6);
            vm.prank(d);
            uncapRound.donate(p1, 1 * 10 ** 6);
        }

        for (uint160 i = 1; i <= 60; i++) {
            address d = address(uint160(0x4000 + i));
            _verifyUser(d);
            deal(address(usdc), d, 5 * 10 ** 6);
            vm.prank(d);
            usdc.approve(address(uncapRound), 5 * 10 ** 6);
            vm.prank(d);
            uncapRound.donate(p2, 5 * 10 ** 6);
        }

        // Sponsor deposits large pool (200,000 USDC) so pool exceeds total raw matching
        uint256 largePool = 200_000 * 10 ** 6;
        deal(address(usdc), admin, largePool);
        vm.prank(admin);
        usdc.approve(address(uncapRound), largePool);
        vm.prank(admin);
        uncapRound.depositPool(largePool);

        (, uint256[] memory estimated) = uncapRound.previewMatching();
        assertEq(estimated.length, 2);

        // Project 1 raw: ~89,700 USDC (within small tolerance of 50 USDC)
        assertApproxEqAbs(estimated[0], 89_700 * 10 ** 6, 50 * 10 ** 6);
        // Project 2 raw: ~17,700 USDC (within small tolerance of 50 USDC)
        assertApproxEqAbs(estimated[1], 17_700 * 10 ** 6, 50 * 10 ** 6);
        assertGt(estimated[0], estimated[1]);
    }

    function test_MockUSDC_ownerMint_and_nonOwnerReverts() public {
        assertEq(usdc.owner(), address(this));

        // Owner can mint any amount with no cap
        uint256 mintAmount = 250_000 * 10 ** 6;
        usdc.mint(donor1, mintAmount);
        assertEq(usdc.balanceOf(donor1), mintAmount);

        // Non-owner reverts with OwnableUnauthorizedAccount
        vm.prank(donor2);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", donor2));
        usdc.mint(donor2, 100 * 10 ** 6);
    }

    function test_FullRound_100kUsdcPool() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "Project 1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "Project 2");
        address projectOwner3 = address(0x33);
        uint256 p3 = _registerAndApproveProject(projectOwner3, "Project 3");

        // Mint 100,000 USDC directly to admin using owner mint()
        uint256 poolAmount = 100_000 * 10 ** 6;
        usdc.mint(admin, poolAmount);
        assertEq(usdc.balanceOf(admin), poolAmount);

        // Admin deposits 100,000 USDC into matching pool
        vm.prank(admin);
        usdc.approve(address(round), poolAmount);
        vm.prank(admin);
        round.depositPool(poolAmount);
        assertEq(round.pool(), poolAmount);

        vm.warp(startTime + 1);

        // 10 student donors donate to p1, p2, p3
        for (uint160 i = 1; i <= 10; i++) {
            address d = address(uint160(0x5000 + i));
            _verifyUser(d);
            _fundAndApprove(d, 15 * 10 ** 6);

            vm.prank(d);
            round.donate(p1, 5 * 10 ** 6);

            if (i <= 6) {
                vm.prank(d);
                round.donate(p2, 3 * 10 ** 6);
            }
            if (i <= 3) {
                vm.prank(d);
                round.donate(p3, 2 * 10 ** 6);
            }
        }

        vm.warp(endTime + 1);
        vm.prank(admin);
        round.finalize();
        assertTrue(round.finalized());

        // Read payouts from previewMatching and ensure bounds
        (, uint256[] memory payouts) = round.previewMatching();
        assertEq(payouts.length, 3);

        uint256 totalPayouts = payouts[0] + payouts[1] + payouts[2];
        assertLe(totalPayouts, poolAmount, "Payouts must never exceed pool");
        assertEq(round.leftover(), poolAmount - totalPayouts, "Leftover calculation must be exact");

        // Project owners claim their allocations
        uint256 p1BalBefore = usdc.balanceOf(projectOwner1);
        vm.prank(projectOwner1);
        round.claim(p1);
        assertEq(usdc.balanceOf(projectOwner1) - p1BalBefore, 50 * 10 ** 6 + payouts[0]);

        uint256 p2BalBefore = usdc.balanceOf(projectOwner2);
        vm.prank(projectOwner2);
        round.claim(p2);
        assertEq(usdc.balanceOf(projectOwner2) - p2BalBefore, 18 * 10 ** 6 + payouts[1]);

        uint256 p3BalBefore = usdc.balanceOf(projectOwner3);
        vm.prank(projectOwner3);
        round.claim(p3);
        assertEq(usdc.balanceOf(projectOwner3) - p3BalBefore, 6 * 10 ** 6 + payouts[2]);

        // Admin withdraws unused leftover funds
        uint256 adminBalBefore = usdc.balanceOf(admin);
        vm.prank(admin);
        round.withdrawLeftover();
        assertEq(usdc.balanceOf(admin) - adminBalBefore, round.leftover());

        // Contract balance must be drained to dust (<= 3 wei for 3 projects)
        assertLe(usdc.balanceOf(address(round)), 3, "Round contract balance must drain to dust");
    }
}
