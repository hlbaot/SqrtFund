// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {QFRound} from "../src/QFRound.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract CancellationHandler is Test {
    QFRound public round;
    MockUSDC public token;
    address public admin;
    address[2] public donors;
    uint256 public totalIn;
    uint256 public totalRefunded;
    uint256 public poolReturned;
    constructor(QFRound r,MockUSDC t,address a,address d1,address d2){round=r;token=t;admin=a;donors=[d1,d2];}
    function donate(uint8 actor,uint8 project,uint96 seed) external {
        if(round.isCancelled())return;
        address who=donors[actor%2];uint256 id=uint256(project%2)+1;
        uint256 room=round.maxDonation()-round.donationOf(who,id);
        uint256 available=round.remainingBudget(who);if(room>available)room=available;
        if(room<round.minDonation())return;
        uint256 amount=bound(uint256(seed),round.minDonation(),room);
        vm.prank(who);round.donate(id,amount);totalIn+=amount;
    }
    function deposit(uint96 seed) external {
        if(round.isCancelled())return;
        uint256 balance=token.balanceOf(admin);if(balance==0)return;
        uint256 amount=bound(uint256(seed),1,balance);
        vm.prank(admin);round.depositPool(amount);totalIn+=amount;
    }
    function cancel() public {if(!round.isCancelled()){vm.prank(admin);round.cancelRound();}}
    function refund(uint8 actor,uint8 project) public {
        if(!round.isCancelled())return;
        address who=donors[actor%2];uint256 id=uint256(project%2)+1;
        uint256 amount=round.donationOf(who,id);if(amount==0)return;
        vm.prank(who);round.refund(id);totalRefunded+=amount;
    }
    function withdrawPool() public {
        if(!round.isCancelled()||round.cancelledPoolWithdrawn())return;
        uint256 amount=round.pool();vm.prank(admin);round.withdrawPoolIfCancelled();poolReturned+=amount;
    }
}
contract RoundCancellationInvariantTest is Test {
    MockUSDC token;StudentRegistry registry;QFRound round;CancellationHandler handler;
    address admin=address(0xAA);address d1=address(0xD1);address d2=address(0xD2);address owner=address(0x11);
    function verify(address who) internal {
        bytes32 email=keccak256(abi.encode(who));uint256 expiry=block.timestamp+365 days;
        bytes32 domain=keccak256(abi.encode(keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),keccak256("SqrtFundStudentRegistry"),keccak256("1"),block.chainid,address(registry)));
        bytes32 message=keccak256(abi.encode(registry.STUDENT_VERIFICATION_TYPEHASH(),who,email,expiry));
        (uint8 v,bytes32 r,bytes32 s)=vm.sign(0xA771,keccak256(abi.encodePacked("\x19\x01",domain,message)));
        vm.prank(who);registry.verifyStudent(email,expiry,abi.encodePacked(r,s,v));
    }
    function setUp() public {
        token=new MockUSDC();registry=new StudentRegistry(vm.addr(0xA771));
        round=new QFRound("Invariant","Club",admin,address(token),block.timestamp,block.timestamp+365 days,1e6,5e6,3000,10e6,address(registry));
        verify(owner);verify(d1);verify(d2);
        for(uint256 i;i<2;++i){vm.prank(owner);uint256 id=round.registerProject("P","D","","");vm.prank(admin);round.approveProject(id);}
        token.mint(d1,10e6);token.mint(d2,10e6);token.mint(admin,100e6);
        vm.prank(d1);token.approve(address(round),type(uint256).max);vm.prank(d2);token.approve(address(round),type(uint256).max);vm.prank(admin);token.approve(address(round),type(uint256).max);
        handler=new CancellationHandler(round,token,admin,d1,d2);
        targetContract(address(handler));
        bytes4[] memory selectors=new bytes4[](5);
        selectors[0]=handler.donate.selector;selectors[1]=handler.deposit.selector;selectors[2]=handler.cancel.selector;selectors[3]=handler.refund.selector;selectors[4]=handler.withdrawPool.selector;
        targetSelector(FuzzSelector({addr:address(handler),selectors:selectors}));
    }
    function invariant_RecognizedInflowsEqualHeldPlusReturned() public view {
        assertEq(handler.totalIn(),token.balanceOf(address(round))+handler.totalRefunded()+handler.poolReturned());
        assertLe(round.spentInRound(d1),round.maxPerRound());assertLe(round.spentInRound(d2),round.maxPerRound());
    }
    function afterInvariant() public {
        handler.cancel();for(uint8 i;i<2;++i)for(uint8 j;j<2;++j)handler.refund(i,j);handler.withdrawPool();
        assertEq(token.balanceOf(address(round)),0);
        assertEq(handler.totalIn(),handler.totalRefunded()+handler.poolReturned());
    }
}
