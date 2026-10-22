// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";
import {RoundFactory} from "../src/RoundFactory.sol";
import {QFRound} from "../src/QFRound.sol";

contract DepositTestToken is ERC20 {
    address public blocked;
    bool public fee;
    constructor() ERC20("Test", "T") { _mint(msg.sender, 1000e6); }
    function configure(address sender, bool chargeFee) external { blocked = sender; fee = chargeFee; }
    function _update(address from, address to, uint256 amount) internal override {
        require(from == address(0) || from != blocked, "Blocked transfer");
        if (fee && from != address(0) && to != address(0) && amount > 0) {
            super._update(from, address(0), 1);
            amount -= 1;
        }
        super._update(from, to, amount);
    }
}

contract InitialPoolDepositTest is Test {
    RoundFactory factory;
    MockUSDC token;
    address admin = address(0xA);
    address nextAdmin = address(0xB);

    function setUp() public {
        token = new MockUSDC();
        StudentRegistry registry = new StudentRegistry(address(0xC));
        vm.prank(admin); factory = new RoundFactory(address(registry));
        token.mint(admin, 1000e6);
        vm.prank(admin); token.approve(address(factory), type(uint256).max);
    }

    function deposit(uint256 amount) internal {
        vm.prank(admin); factory.depositInitialPool(address(token), amount);
    }

    function create(uint256 amount) internal returns (QFRound) {
        vm.prank(admin);
        return QFRound(factory.createFundedRound("Funded", "University", address(token), block.timestamp,
            block.timestamp + 7 days, 1e6, 5e6, 3000, 10e6, amount));
    }

    function test_DepositConfirmsBeforeAnyRoundExists() public {
        deposit(100e6);
        assertEq(factory.roundCount(), 0);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 100e6);
        assertEq(token.balanceOf(address(factory)), 100e6);
        assertEq(token.balanceOf(admin), 900e6);
    }

    function test_OrganizerCanDepositAndCreateOnlyWithItsOwnCredit() public {
        vm.prank(admin); factory.setOrganizer(nextAdmin, true);
        token.mint(nextAdmin, 50e6);
        deposit(100e6);
        vm.startPrank(nextAdmin);
        vm.expectRevert(RoundFactory.InsufficientDeposit.selector);
        factory.createFundedRound("Campus", "Org", address(token), 1, 2, 1e6, 5e6, 3000, 10e6, 10e6);
        token.approve(address(factory), 50e6);
        factory.depositInitialPool(address(token), 50e6);
        assertEq(factory.roundCount(), 0);
        QFRound funded = QFRound(factory.createFundedRound("Campus", "Org", address(token), 1, 2, 1e6, 5e6, 3000, 10e6, 50e6));
        vm.stopPrank();
        assertEq(funded.admin(), nextAdmin);
        assertEq(funded.pool(), 50e6);
        assertEq(token.balanceOf(address(funded)), 50e6);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 100e6);
    }

    function test_RevokedOrganizerCannotCreateButCanRefundItsDeposit() public {
        vm.prank(admin); factory.setOrganizer(nextAdmin, true);
        token.mint(nextAdmin, 50e6);
        vm.startPrank(nextAdmin);
        token.approve(address(factory), 50e6);
        factory.depositInitialPool(address(token), 50e6);
        vm.stopPrank();
        vm.prank(admin); factory.setOrganizer(nextAdmin, false);
        vm.startPrank(nextAdmin);
        vm.expectRevert(bytes("Not authorized"));
        factory.createFundedRound("Campus", "Org", address(token), 1, 2, 1e6, 5e6, 3000, 10e6, 50e6);
        factory.withdrawInitialPool(address(token), 50e6);
        vm.stopPrank();
        assertEq(token.balanceOf(nextAdmin), 50e6);
        assertEq(factory.roundCount(), 0);
    }

    function test_CreateRequiresConfirmedPositiveDeposit() public {
        vm.expectRevert(RoundFactory.InsufficientDeposit.selector); create(1e6);
        vm.expectRevert(RoundFactory.InvalidDeposit.selector); create(0);
        assertEq(factory.roundCount(), 0);
        deposit(1e6);
        vm.expectRevert(RoundFactory.InsufficientDeposit.selector); create(2e6);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 1e6);
    }

    function test_FundedRoundHasActualTokensAndCorrectAdmin() public {
        deposit(100e6);
        QFRound round = create(80e6);
        assertEq(round.admin(), admin);
        assertEq(round.pool(), 80e6);
        assertEq(token.balanceOf(address(round)), 80e6);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 20e6);
        assertEq(token.balanceOf(address(factory)), 20e6);
        assertEq(factory.roundCount(), 1);
        vm.expectRevert(RoundFactory.InsufficientDeposit.selector); create(80e6);
    }

    function test_InvalidRoundRollsBackCreditAndCreation() public {
        deposit(100e6);
        vm.prank(admin); vm.expectRevert(QFRound.InvalidTimeRange.selector);
        factory.createFundedRound("Bad", "Org", address(token), 100, 99, 1e6, 5e6, 3000, 10e6, 100e6);
        assertEq(factory.roundCount(), 0);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 100e6);
        assertEq(token.balanceOf(address(factory)), 100e6);
    }

    function test_RefundSurvivesOwnershipTransferAndCannotBeStolen() public {
        deposit(100e6);
        vm.prank(admin); factory.transferOwnership(nextAdmin);
        vm.prank(nextAdmin); vm.expectRevert(RoundFactory.InsufficientDeposit.selector);
        factory.withdrawInitialPool(address(token), 100e6);
        vm.prank(nextAdmin); vm.expectRevert(RoundFactory.InsufficientDeposit.selector);
        factory.createFundedRound("Other", "Org", address(token), 1, 2, 1e6, 5e6, 3000, 10e6, 100e6);
        vm.prank(admin); factory.withdrawInitialPool(address(token), 100e6);
        assertEq(token.balanceOf(admin), 1000e6);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 0);
        vm.prank(admin); vm.expectRevert(RoundFactory.InsufficientDeposit.selector);
        factory.withdrawInitialPool(address(token), 100e6);
    }

    function test_RejectsZeroAndNonOwnerDeposit() public {
        vm.prank(admin); vm.expectRevert(RoundFactory.InvalidDeposit.selector);
        factory.depositInitialPool(address(token), 0);
        vm.prank(nextAdmin); vm.expectRevert(); factory.depositInitialPool(address(token), 1e6);
        assertEq(factory.initialPoolDeposits(nextAdmin, address(token)), 0);
    }

    function test_TokenTransferFailureRollsBackEntireCreation() public {
        DepositTestToken bad = new DepositTestToken();
        bad.transfer(admin, 100e6);
        vm.startPrank(admin);
        bad.approve(address(factory), 100e6);
        factory.depositInitialPool(address(bad), 100e6);
        vm.stopPrank();
        bad.configure(address(factory), false);
        vm.prank(admin); vm.expectRevert();
        factory.createFundedRound("Bad token", "Org", address(bad), 1, 2, 1e6, 5e6, 3000, 10e6, 100e6);
        assertEq(factory.roundCount(), 0);
        assertEq(factory.initialPoolDeposits(admin, address(bad)), 100e6);
        assertEq(bad.balanceOf(address(factory)), 100e6);
    }

    function test_RejectsTransferFeesAtDepositAndCreation() public {
        DepositTestToken fee = new DepositTestToken();
        fee.transfer(admin, 100e6);
        vm.prank(admin); fee.approve(address(factory), 100e6);
        fee.configure(address(0), true);
        vm.prank(admin); vm.expectRevert(RoundFactory.UnsupportedToken.selector);
        factory.depositInitialPool(address(fee), 100e6);
        assertEq(factory.initialPoolDeposits(admin, address(fee)), 0);
        fee.configure(address(0), false);
        vm.prank(admin); factory.depositInitialPool(address(fee), 100e6);
        fee.configure(address(0), true);
        vm.prank(admin); vm.expectRevert(RoundFactory.UnsupportedToken.selector);
        factory.createFundedRound("Fee", "Org", address(fee), 1, 2, 1e6, 5e6, 3000, 10e6, 100e6);
        assertEq(factory.roundCount(), 0);
        assertEq(factory.initialPoolDeposits(admin, address(fee)), 100e6);
    }

    function test_InitialPoolCanBeSettledAndWithdrawnByRoundAdmin() public {
        deposit(100e6);
        QFRound round = create(100e6);
        vm.warp(round.endTime());
        vm.startPrank(admin); round.finalize(); round.withdrawLeftover(); vm.stopPrank();
        assertEq(token.balanceOf(admin), 1000e6);
        assertEq(token.balanceOf(address(round)), 0);
    }

    function test_DustSentToPredictedRoundDoesNotBlockCreation() public {
        address predicted = vm.computeCreateAddress(address(factory), 1);
        token.mint(predicted, 1);
        deposit(100e6);
        QFRound round = create(100e6);
        assertEq(address(round), predicted);
        assertEq(round.pool(), 100e6);
        assertEq(token.balanceOf(address(round)), 100e6 + 1);
    }

    function testFuzz_ConservesDepositsAcrossCreateAndRefund(uint96 raw, uint96 used) public {
        uint256 amount = bound(uint256(raw), 1, 1000e6);
        uint256 spend = bound(uint256(used), 1, amount);
        deposit(amount);
        QFRound round = create(spend);
        uint256 remaining = amount - spend;
        if (remaining > 0) { vm.prank(admin); factory.withdrawInitialPool(address(token), remaining); }
        assertEq(token.balanceOf(address(factory)), 0);
        assertEq(token.balanceOf(admin) + token.balanceOf(address(round)), 1000e6);
        assertEq(factory.initialPoolDeposits(admin, address(token)), 0);
    }
}
