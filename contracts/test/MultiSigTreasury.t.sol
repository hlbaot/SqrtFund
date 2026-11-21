// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MultiSigTreasury} from "../src/MultiSigTreasury.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MultiSigTreasuryTest is Test {
    MultiSigTreasury ms;
    MockUSDC usdc;
    address a = address(0xA1);
    address b = address(0xB2);
    address c = address(0xC3);
    address outsider = address(0xDEAD);

    function setUp() public {
        address[] memory os = new address[](3);
        os[0] = a;
        os[1] = b;
        os[2] = c;
        ms = new MultiSigTreasury(os, 2);
        usdc = new MockUSDC();
        usdc.mint(address(ms), 1000e6);
        vm.deal(address(ms), 5 ether);
    }

    function test_ConstructorValidation() public {
        address[] memory os = new address[](2);
        os[0] = a;
        os[1] = a;
        vm.expectRevert(MultiSigTreasury.DuplicateOwner.selector);
        new MultiSigTreasury(os, 1);
        os[1] = b;
        vm.expectRevert(MultiSigTreasury.InvalidThreshold.selector);
        new MultiSigTreasury(os, 3);
    }

    function test_TokenTransferNeedsThreshold() public {
        vm.prank(a);
        uint256 id = ms.submit(address(usdc), 0, abi.encodeCall(usdc.transfer, (address(0x1), 100e6)));

        vm.prank(a);
        vm.expectRevert(MultiSigTreasury.NotEnoughConfirmations.selector);
        ms.execute(id);

        vm.prank(b);
        ms.confirm(id);
        vm.prank(c);
        ms.execute(id);
        assertEq(usdc.balanceOf(address(0x1)), 100e6);

        vm.prank(a);
        vm.expectRevert(MultiSigTreasury.AlreadyExecuted.selector);
        ms.execute(id);
    }

    function test_NativeTransfer() public {
        vm.prank(a);
        uint256 id = ms.submit(address(0xCAFE), 2 ether, "");
        vm.prank(b);
        ms.confirm(id);
        vm.prank(b);
        ms.execute(id);
        assertEq(address(0xCAFE).balance, 2 ether);
    }

    function test_RevokeAndDoubleConfirm() public {
        vm.prank(a);
        uint256 id = ms.submit(address(0xCAFE), 1, "");
        vm.prank(a);
        vm.expectRevert(MultiSigTreasury.AlreadyConfirmed.selector);
        ms.confirm(id);
        vm.prank(a);
        ms.revoke(id);
        vm.prank(b);
        ms.confirm(id);
        vm.prank(b);
        vm.expectRevert(MultiSigTreasury.NotEnoughConfirmations.selector);
        ms.execute(id);
    }

    function test_OutsiderBlocked() public {
        vm.prank(outsider);
        vm.expectRevert(MultiSigTreasury.NotOwner.selector);
        ms.submit(address(1), 0, "");
    }

    function test_GovernanceOnlyViaMultisig() public {
        vm.prank(a);
        vm.expectRevert(MultiSigTreasury.NotSelf.selector);
        ms.addOwner(outsider);

        vm.prank(a);
        uint256 id = ms.submit(address(ms), 0, abi.encodeCall(ms.addOwner, (outsider)));
        vm.prank(b);
        ms.confirm(id);
        vm.prank(a);
        ms.execute(id);
        assertTrue(ms.isOwner(outsider));
        assertEq(ms.owners().length, 4);

        vm.prank(a);
        id = ms.submit(address(ms), 0, abi.encodeCall(ms.changeThreshold, (3)));
        vm.prank(b);
        ms.confirm(id);
        vm.prank(a);
        ms.execute(id);
        assertEq(ms.threshold(), 3);
    }

    function test_CannotRemoveOwnerBelowThreshold() public {
        vm.prank(a);
        uint256 id = ms.submit(address(ms), 0, abi.encodeCall(ms.changeThreshold, (3)));
        vm.prank(b);
        ms.confirm(id);
        vm.prank(a);
        ms.execute(id);

        vm.prank(a);
        id = ms.submit(address(ms), 0, abi.encodeCall(ms.removeOwner, (c)));
        vm.prank(b);
        ms.confirm(id);
        vm.prank(c);
        ms.confirm(id);
        vm.prank(a);
        vm.expectRevert(); // lời gọi bên trong revert -> CallFailed
        ms.execute(id);
    }
}
