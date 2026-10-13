// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {QFRound} from "../src/QFRound.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

contract QFRoundTest is Test {
    MockUSDC public usdc;
    RoundFactory public factory;
    QFRound public round;

    address public admin = address(0xAA);
    address public sponsor = address(0xBB);
    address public projectOwner1 = address(0x11);
    address public projectOwner2 = address(0x22);
    address public donor1 = address(0xD1);
    address public donor2 = address(0xD2);

    uint256 public startTime;
    uint256 public endTime;
    uint256 public minDonation = 1 * 10 ** 6; // 1 USDC
    uint256 public maxDonation = 5 * 10 ** 6; // 5 USDC
    uint256 public maxMatchBps = 3000; // 30%

    function setUp() public {
        startTime = block.timestamp + 1 hours;
        endTime = startTime + 7 days;

        usdc = new MockUSDC();
        vm.prank(admin);
        factory = new RoundFactory();

        vm.prank(admin);
        address roundAddr = factory.createRound(
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps
        );
        round = QFRound(roundAddr);
    }

    // --- Helper Utilities ---

    function _whitelistUser(address user) internal {
        vm.prank(admin);
        round.setWhitelist(user, true);
    }

    function _registerAndApproveProject(address owner, string memory name) internal returns (uint256 pId) {
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
            _whitelistUser(d);
            _fundAndApprove(d, 1 * 10 ** 6);
            vm.prank(d);
            round.donate(p1, 1 * 10 ** 6);
        }

        for (uint160 i = 1; i <= 60; i++) {
            address d = address(uint160(0x2000 + i));
            _whitelistUser(d);
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

        _whitelistUser(donor1);
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
        // S^2 / 10^12 = 2,999,999,996 <= totalDonated (3,000,000)
        // Raw matching MUST be 0!
        assertEq(estimated[0], 0);
    }

    function test_DonationLimits_PerProject_And_MultipleProjects() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "Project 1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "Project 2");

        vm.warp(startTime + 1);
        _whitelistUser(donor1);
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
            address(usdc),
            startTime,
            endTime,
            minDonation,
            maxDonation,
            10000
        );
        QFRound uncapRound = QFRound(rAddr);

        vm.prank(projectOwner1);
        uint256 p1 = uncapRound.registerProject("P1", "Desc", "url", "url");
        vm.prank(projectOwner2);
        uint256 p2 = uncapRound.registerProject("P2", "Desc", "url", "url");
        vm.prank(admin);
        uncapRound.approveProject(p1);
        vm.prank(admin);
        uncapRound.approveProject(p2);

        vm.warp(startTime + 1);
        vm.prank(admin);
        uncapRound.setWhitelist(donor1, true);
        vm.prank(admin);
        uncapRound.setWhitelist(donor2, true);

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
        _whitelistUser(donor1);
        _whitelistUser(donor2);
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
        round.finalize();

        uint256 payout1 = round.payoutOf(p1);
        assertEq(payout1, 3 * 10 ** 6); // Exactly capped at 30%
        assertEq(round.leftover(), 7 * 10 ** 6);
    }

    function test_PoolLargerThanTotalRaw_LeftoverAndWithdraw() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");

        vm.warp(startTime + 1);
        _whitelistUser(donor1);
        _whitelistUser(donor2);
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
        _whitelistUser(donor1);
        _whitelistUser(donor2);
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
        round.finalize();

        for (uint256 i = 0; i < ids.length; i++) {
            assertEq(previewPayouts[i], round.payoutOf(ids[i]));
        }
    }

    // --- Whitelist & Verification Flow ---

    function test_VerificationFlow() public {
        address student = address(0x777);

        // Request verification
        vm.prank(student);
        round.requestVerification();
        assertTrue(round.requested(student));
        assertFalse(round.isWhitelisted(student));

        (address[] memory requesters, uint256 count) = round.getRequesters(0, 10);
        assertEq(count, 1);
        assertEq(requesters[0], student);

        // Cannot request again while pending
        vm.prank(student);
        vm.expectRevert(QFRound.AlreadyRequested.selector);
        round.requestVerification();

        // Admin approves student
        vm.prank(admin);
        round.setWhitelist(student, true);
        assertTrue(round.isWhitelisted(student));
        assertFalse(round.requested(student));

        (, count) = round.getRequesters(0, 10);
        assertEq(count, 0);

        // Cannot request if already whitelisted
        vm.prank(student);
        vm.expectRevert(QFRound.AlreadyWhitelisted.selector);
        round.requestVerification();

        // Test rejection flow
        address rejectedStudent = address(0x888);
        vm.prank(rejectedStudent);
        round.requestVerification();
        assertTrue(round.requested(rejectedStudent));

        vm.prank(admin);
        round.setWhitelist(rejectedStudent, false);
        assertFalse(round.isWhitelisted(rejectedStudent));
        assertFalse(round.requested(rejectedStudent));
    }

    // --- Batch Whitelist ---

    function test_BatchWhitelist() public {
        address[] memory users = new address[](3);
        bool[] memory statuses = new bool[](3);
        users[0] = address(0x101);
        users[1] = address(0x102);
        users[2] = address(0x103);
        statuses[0] = true;
        statuses[1] = true;
        statuses[2] = false;

        vm.prank(admin);
        round.setWhitelistBatch(users, statuses);

        assertTrue(round.isWhitelisted(users[0]));
        assertTrue(round.isWhitelisted(users[1]));
        assertFalse(round.isWhitelisted(users[2]));

        // Batch > 50 reverts
        address[] memory largeBatch = new address[](51);
        bool[] memory largeStatuses = new bool[](51);
        vm.prank(admin);
        vm.expectRevert(QFRound.BatchTooLarge.selector);
        round.setWhitelistBatch(largeBatch, largeStatuses);
    }

    // --- Claim Flow ---

    function test_ClaimFlow() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "Project 1");

        vm.warp(startTime + 1);
        _whitelistUser(donor1);
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
        _whitelistUser(projectOwner1);
        _fundAndApprove(projectOwner1, 2 * 10 ** 6);
        vm.warp(startTime + 1);
        vm.prank(projectOwner1);
        vm.expectRevert(QFRound.SelfDonationNotAllowed.selector);
        round.donate(p1, 2 * 10 ** 6);

        // Non-whitelisted donate reverts
        _fundAndApprove(donor1, 2 * 10 ** 6);
        vm.prank(donor1);
        vm.expectRevert(QFRound.NotWhitelisted.selector);
        round.donate(p1, 2 * 10 ** 6);

        // Donate to unapproved project reverts
        vm.prank(projectOwner2);
        uint256 unapprovedP = round.registerProject("Unapproved", "Desc", "url", "url");
        _whitelistUser(donor1);
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
        round.finalize();
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
        for (uint256 i = 0; i < 50; i++) {
            round.registerProject("Project", "Desc", "https://img", "https://site");
        }
        assertEq(round.projectCount(), 50);

        // 51st project reverts
        vm.expectRevert(QFRound.MaxProjectsReached.selector);
        round.registerProject("51st", "Desc", "https://img", "https://site");
    }

    function test_MaxRequestersBoundary() public {
        for (uint160 i = 1; i <= 500; i++) {
            address req = address(uint160(0x9000 + i));
            vm.prank(req);
            round.requestVerification();
        }

        // 501st requester reverts
        address extra = address(0x9999);
        vm.prank(extra);
        vm.expectRevert(QFRound.MaxRequestersReached.selector);
        round.requestVerification();
    }

    // --- Accounting Invariant Test ---

    function test_AccountingDustBound() public {
        uint256 p1 = _registerAndApproveProject(projectOwner1, "P1");
        uint256 p2 = _registerAndApproveProject(projectOwner2, "P2");

        vm.warp(startTime + 1);
        _whitelistUser(donor1);
        _whitelistUser(donor2);
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
        _whitelistUser(donor1);
        _whitelistUser(donor2);
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
}
