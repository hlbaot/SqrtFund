// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SmartWallet} from "../src/SmartWallet.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract SmartWalletTest is Test {
    WalletFactory factory;
    SmartWallet wallet;
    MockUSDC usdc;

    uint256 ownerKey = 0xA11CE;
    address owner;
    address relayer = address(0xBEEF);
    address g1 = address(0x61);
    address g2 = address(0x62);
    address g3 = address(0x63);
    address newOwner = address(0x999);

    function setUp() public {
        owner = vm.addr(ownerKey);
        factory = new WalletFactory();
        wallet = SmartWallet(payable(factory.createWallet(owner, bytes32(uint256(1)))));
        usdc = new MockUSDC();
        vm.deal(address(wallet), 10 ether);
    }

    function _guardians() internal {
        address[] memory gs = new address[](3);
        gs[0] = g1;
        gs[1] = g2;
        gs[2] = g3;
        vm.prank(owner);
        wallet.setGuardians(gs, 2, 1 days);
    }

    // ---- factory ----

    function test_FactoryPredictsAddressAndIsIdempotent() public {
        address predicted = factory.getAddress(address(0x1234), bytes32(uint256(7)));
        assertEq(predicted.code.length, 0);
        address created = factory.createWallet(address(0x1234), bytes32(uint256(7)));
        assertEq(created, predicted);
        assertEq(factory.createWallet(address(0x1234), bytes32(uint256(7))), predicted);
        assertEq(factory.walletsOf(address(0x1234)).length, 1);
        assertEq(SmartWallet(payable(created)).owner(), address(0x1234));
    }

    function test_CannotReinitializeOrInitImplementation() public {
        vm.expectRevert(SmartWallet.AlreadyInitialized.selector);
        wallet.initialize(address(1));
        SmartWallet impl = SmartWallet(payable(factory.implementation()));
        vm.expectRevert(SmartWallet.AlreadyInitialized.selector);
        impl.initialize(address(1));
    }

    // ---- execute ----

    function test_OwnerExecutesTransferAndBatch() public {
        vm.prank(owner);
        wallet.execute(address(0xCAFE), 1 ether, "");
        assertEq(address(0xCAFE).balance, 1 ether);

        usdc.mint(address(wallet), 100e6);
        SmartWallet.Call[] memory calls = new SmartWallet.Call[](2);
        calls[0] = SmartWallet.Call(address(usdc), 0, abi.encodeCall(usdc.transfer, (address(0xA), 40e6)));
        calls[1] = SmartWallet.Call(address(usdc), 0, abi.encodeCall(usdc.transfer, (address(0xB), 60e6)));
        vm.prank(owner);
        wallet.executeBatch(calls);
        assertEq(usdc.balanceOf(address(0xA)), 40e6);
        assertEq(usdc.balanceOf(address(0xB)), 60e6);
    }

    function test_NonOwnerCannotExecute() public {
        vm.prank(relayer);
        vm.expectRevert(SmartWallet.NotOwner.selector);
        wallet.execute(address(0xCAFE), 1, "");
    }

    function test_BatchRevertsAtomically() public {
        SmartWallet.Call[] memory calls = new SmartWallet.Call[](2);
        calls[0] = SmartWallet.Call(address(0xCAFE), 1 ether, "");
        calls[1] = SmartWallet.Call(address(usdc), 0, abi.encodeCall(usdc.transfer, (address(1), 1)));
        vm.prank(owner);
        vm.expectRevert();
        wallet.executeBatch(calls); // wallet has no USDC
        assertEq(address(0xCAFE).balance, 0);
    }

    // ---- meta tx ----

    function _sign(address target, uint256 value, bytes memory data, uint256 n, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 structHash =
            keccak256(abi.encode(wallet.EXECUTE_TYPEHASH(), target, value, keccak256(data), n, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", wallet.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(ownerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function test_RelayerExecutesSignedCallOnce() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(address(0xCAFE), 1 ether, "", 0, deadline);
        vm.prank(relayer);
        wallet.executeWithSig(address(0xCAFE), 1 ether, "", deadline, sig);
        assertEq(address(0xCAFE).balance, 1 ether);
        assertEq(wallet.nonce(), 1);

        vm.prank(relayer);
        vm.expectRevert(SmartWallet.InvalidSignature.selector); // replay
        wallet.executeWithSig(address(0xCAFE), 1 ether, "", deadline, sig);
    }

    function test_SignatureExpiredOrWrongSigner() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory sig = _sign(address(0xCAFE), 1 ether, "", 0, deadline);
        // tampered value
        vm.expectRevert(SmartWallet.InvalidSignature.selector);
        wallet.executeWithSig(address(0xCAFE), 2 ether, "", deadline, sig);
        vm.warp(deadline + 1);
        vm.expectRevert(SmartWallet.SignatureExpired.selector);
        wallet.executeWithSig(address(0xCAFE), 1 ether, "", deadline, sig);
    }

    // ---- daily limit ----

    function test_DailyLimitEnforcedAndResets() public {
        vm.startPrank(owner);
        wallet.setDailyLimit(2 ether);
        wallet.execute(address(0xCAFE), 1.5 ether, "");
        vm.expectRevert(SmartWallet.DailyLimitExceeded.selector);
        wallet.execute(address(0xCAFE), 1 ether, "");
        vm.warp(block.timestamp + 1 days);
        wallet.execute(address(0xCAFE), 1 ether, "");
        vm.stopPrank();
        assertEq(address(0xCAFE).balance, 2.5 ether);
    }

    // ---- recovery ----

    function test_SetGuardiansValidation() public {
        address[] memory gs = new address[](2);
        gs[0] = g1;
        gs[1] = g1;
        vm.startPrank(owner);
        vm.expectRevert(SmartWallet.DuplicateGuardian.selector);
        wallet.setGuardians(gs, 1, 1 days);
        gs[1] = g2;
        vm.expectRevert(SmartWallet.InvalidThreshold.selector);
        wallet.setGuardians(gs, 3, 1 days);
        vm.expectRevert(SmartWallet.DelayTooShort.selector);
        wallet.setGuardians(gs, 2, 1 hours);
        vm.stopPrank();
    }

    function test_RecoveryHappyPath() public {
        _guardians();
        vm.prank(g1);
        wallet.startRecovery(newOwner);

        vm.prank(g2);
        wallet.approveRecovery();

        vm.expectRevert(SmartWallet.RecoveryNotReady.selector); // delay not elapsed
        wallet.executeRecovery();

        vm.warp(block.timestamp + 1 days);
        wallet.executeRecovery();
        assertEq(wallet.owner(), newOwner);

        vm.prank(owner);
        vm.expectRevert(SmartWallet.NotOwner.selector);
        wallet.execute(address(1), 0, "");
    }

    function test_RecoveryNeedsThreshold() public {
        _guardians();
        vm.prank(g1);
        wallet.startRecovery(newOwner);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(SmartWallet.RecoveryNotReady.selector);
        wallet.executeRecovery();
    }

    function test_GuardianCannotDoubleApproveAndStrangerRejected() public {
        _guardians();
        vm.prank(g1);
        wallet.startRecovery(newOwner);
        vm.prank(g1);
        vm.expectRevert(SmartWallet.AlreadyApproved.selector);
        wallet.approveRecovery();
        vm.prank(relayer);
        vm.expectRevert(SmartWallet.NotGuardian.selector);
        wallet.approveRecovery();
    }

    function test_OwnerCanCancelRecovery() public {
        _guardians();
        vm.prank(g1);
        wallet.startRecovery(newOwner);
        vm.prank(g2);
        wallet.approveRecovery();
        vm.prank(owner);
        wallet.cancelRecovery();
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(SmartWallet.NoRecovery.selector);
        wallet.executeRecovery();
        assertEq(wallet.owner(), owner);
    }

    function test_NewRecoveryRoundInvalidatesOldApprovals() public {
        _guardians();
        vm.prank(g1);
        wallet.startRecovery(newOwner);
        vm.prank(g2);
        wallet.approveRecovery();
        // g3 restarts with a different target: only 1 approval in the new round
        vm.prank(g3);
        wallet.startRecovery(address(0x777));
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(SmartWallet.RecoveryNotReady.selector);
        wallet.executeRecovery();
    }

    function test_ReceivesAvax() public {
        vm.deal(relayer, 1 ether);
        vm.prank(relayer);
        (bool ok,) = address(wallet).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(wallet).balance, 11 ether);
    }
}
