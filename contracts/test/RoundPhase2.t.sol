// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Vm} from "forge-std/Vm.sol";
import {QFRoundTest} from "./QFRound.t.sol";
import {QFRound} from "../src/QFRound.sol";

contract RoundPhase2Test is QFRoundTest {
    function _prepare() internal returns (uint256 a, uint256 b) {
        a = _registerAndApproveProject(projectOwner1, "A");
        b = _registerAndApproveProject(projectOwner2, "B");
        _verifyUser(donor1); _verifyUser(donor2);
        _fundAndApprove(donor1, 10e6); _fundAndApprove(donor2, 10e6);
        _fundAndApprove(admin, 100e6); vm.prank(admin); round.depositPool(100e6);
        vm.warp(startTime);
    }
    function _two(uint256 a, uint256 b) internal pure returns (uint256[] memory ids) {
        ids = new uint256[](2); ids[0] = a; ids[1] = b;
    }
    function test_CancelRefundAllAndPoolAccounting() public {
        (uint256 a, uint256 b) = _prepare();
        vm.prank(donor1); round.donateMany(_two(a,b), _two(2e6,3e6));
        vm.prank(donor2); round.donate(a, 4e6);
        assertEq(usdc.balanceOf(address(round)), 109e6);
        vm.prank(admin); round.cancelRound();
        vm.prank(admin); round.withdrawPoolIfCancelled();
        assertEq(usdc.balanceOf(address(round)), 9e6); // Pool withdrawal cannot spend donor deposits.
        vm.warp(endTime + 1000 days); // There is no refund deadline.
        vm.prank(donor1); round.refundMany(_two(a,b));
        vm.prank(donor2); round.refund(a);
        assertEq(usdc.balanceOf(donor1), 10e6); assertEq(usdc.balanceOf(donor2), 10e6);
        assertEq(usdc.balanceOf(admin), 100e6); assertEq(usdc.balanceOf(address(round)), 0);
        assertEq(round.spentInRound(donor1), 0); assertEq(round.donationOf(donor1,a), 0);
        QFRound.ProjectView[] memory p; (p,) = round.getProjects(0,50);
        assertEq(p[0].sumSqrt,0); assertEq(p[0].totalDonated,0); assertEq(p[0].donorCount,0);
        vm.prank(donor1); vm.expectRevert(QFRound.NothingToRefund.selector); round.refund(a);
        vm.prank(admin); vm.expectRevert(QFRound.CancelledPoolAlreadyWithdrawn.selector); round.withdrawPoolIfCancelled();
    }
    function test_NoTimeoutRefundWithoutCancellation() public {
        (uint256 a,) = _prepare(); vm.prank(donor1); round.donate(a, 1e6);
        vm.warp(endTime + 1000 days);
        vm.prank(donor1); vm.expectRevert(QFRound.RoundNotCancelled.selector); round.refund(a);
        vm.prank(admin); vm.expectRevert(QFRound.RoundNotCancelled.selector); round.withdrawPoolIfCancelled();
    }
    function test_CancellationAccessAndFinalizeBoundary() public {
        _prepare();
        vm.prank(donor1); vm.expectRevert(QFRound.NotAdmin.selector); round.cancelRound();
        vm.warp(endTime); vm.prank(admin); round.finalize();
        vm.prank(admin); vm.expectRevert(QFRound.AlreadyFinalized.selector); round.cancelRound();
    }
    function test_CancelBlocksAllFundingActions() public {
        (uint256 a,uint256 b) = _prepare(); vm.prank(admin); round.cancelRound();
        vm.prank(admin); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.cancelRound();
        vm.prank(donor1); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.donate(a,1e6);
        vm.prank(donor1); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.donateMany(_two(a,b),_two(1e6,1e6));
        vm.prank(donor1); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.registerProject("C","D","","");
        vm.prank(admin); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.approveProject(a);
        vm.prank(admin); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.depositPool(1);
        vm.prank(admin); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.finalize();
        vm.prank(projectOwner1); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.claim(a);
        vm.prank(donor1); vm.expectRevert(QFRound.NotAdmin.selector); round.withdrawPoolIfCancelled();
        (,uint256[] memory payouts) = round.previewMatching(); assertEq(payouts[0],0);
    }
    function test_RefundBatchIsAtomicAndBounded() public {
        (uint256 a,uint256 b) = _prepare(); vm.prank(donor1); round.donate(a,2e6);
        vm.prank(admin); round.cancelRound();
        vm.prank(donor2); vm.expectRevert(QFRound.NothingToRefund.selector); round.refund(a);
        vm.prank(donor1); vm.expectRevert(QFRound.NothingToRefund.selector); round.refundMany(_two(a,b));
        assertEq(round.donationOf(donor1,a),2e6); // First refund rolled back.
        vm.prank(donor1); vm.expectRevert(QFRound.NothingToRefund.selector); round.refundMany(_two(a,a));
        vm.prank(donor1); vm.expectRevert(QFRound.BatchTooLarge.selector); round.refundMany(new uint256[](51));
        vm.prank(donor1); vm.expectRevert(QFRound.EmptyBatch.selector); round.refundMany(new uint256[](0));
        vm.prank(donor1); vm.expectRevert(QFRound.ProjectNotFound.selector); round.refund(999);
        assertEq(usdc.balanceOf(address(round)),102e6);
    }
    function test_DonateManyLimitsAndAtomicRollback() public {
        (uint256 a,uint256 b) = _prepare();
        vm.prank(donor1); vm.expectRevert(QFRound.DonationExceedsMax.selector); round.donateMany(_two(a,b),_two(1e6,6e6));
        assertEq(round.spentInRound(donor1),0); assertEq(round.donationOf(donor1,a),0);
        vm.prank(donor1); vm.expectRevert(QFRound.DonationExceedsMax.selector); round.donateMany(_two(a,a),_two(3e6,3e6));
        vm.prank(donor1); vm.expectRevert(QFRound.DonationBelowMin.selector); round.donateMany(_two(a,b),_two(1e6,0));
        vm.prank(donor1); vm.expectRevert(QFRound.ProjectNotApproved.selector); round.donateMany(_two(a,999),_two(1e6,1e6));
        vm.prank(donor1); vm.expectRevert(QFRound.BatchLengthMismatch.selector); round.donateMany(_two(a,b),new uint256[](1));
        vm.prank(donor1); vm.expectRevert(QFRound.BatchTooLarge.selector); round.donateMany(new uint256[](51),new uint256[](51));
        vm.prank(donor1); vm.expectRevert(QFRound.EmptyBatch.selector); round.donateMany(new uint256[](0),new uint256[](0));
        address stranger = address(0x991);
        vm.prank(stranger); vm.expectRevert(QFRound.NotStudent.selector); round.donateMany(_two(a,b),_two(1e6,1e6));
        vm.prank(projectOwner1); vm.expectRevert(QFRound.SelfDonationNotAllowed.selector); round.donateMany(_two(a,b),_two(1e6,1e6));
        vm.prank(donor1); round.donateMany(_two(a,b),_two(5e6,5e6));
        uint256 c = _registerAndApproveProject(address(0x9911),"C");
        vm.prank(donor1); vm.expectRevert(QFRound.RoundBudgetExceeded.selector); round.donateMany(_two(c,c),_two(1e6,1e6));
        assertEq(round.spentInRound(donor1),10e6);
    }
    function test_DonateManyFailedTokenTransferRollsBack() public {
        (uint256 a,uint256 b) = _prepare(); vm.prank(donor1); usdc.approve(address(round),0);
        vm.prank(donor1); vm.expectRevert(); round.donateMany(_two(a,b),_two(2e6,3e6));
        assertEq(round.spentInRound(donor1),0); assertEq(round.donationOf(donor1,a),0);
        assertEq(usdc.balanceOf(address(round)),100e6);
    }
    function testFuzz_DonateManyEqualsSequential(uint96 seedA,uint96 seedB) public {
        (uint256 a,uint256 b) = _prepare();
        uint256 x = bound(uint256(seedA),1e6,2e6); uint256 y = bound(uint256(seedB),1e6,2e6);
        uint256 snapshot = vm.snapshotState();
        vm.prank(donor1); round.donate(a,x); vm.prank(donor1); round.donate(a,y); vm.prank(donor1); round.donate(b,1e6);
        (QFRound.ProjectView[] memory sequential,) = round.getProjects(0,50);
        vm.revertToState(snapshot);
        uint256[] memory ids = new uint256[](3); ids[0]=a;ids[1]=a;ids[2]=b;
        uint256[] memory amounts = new uint256[](3); amounts[0]=x;amounts[1]=y;amounts[2]=1e6;
        vm.prank(donor1); round.donateMany(ids,amounts);
        (QFRound.ProjectView[] memory batch,) = round.getProjects(0,50);
        assertEq(keccak256(abi.encode(sequential)),keccak256(abi.encode(batch)));
        assertEq(round.spentInRound(donor1),x+y+1e6); assertLe(round.spentInRound(donor1),maxPerRound);
    }
    function testFuzz_CancelConservation(uint96 xSeed,uint96 ySeed,uint96 poolSeed,bool poolFirst) public {
        (uint256 a,uint256 b) = _prepare();
        uint256 x=bound(uint256(xSeed),1e6,5e6);uint256 y=bound(uint256(ySeed),1e6,5e6);
        uint256 extra=bound(uint256(poolSeed),1,1_000_000e6);
        _fundAndApprove(admin,extra); vm.prank(admin); round.depositPool(extra);
        vm.prank(donor1); round.donateMany(_two(a,b),_two(x,y)); vm.prank(donor2); round.donate(a,1e6);
        uint256 allIn=usdc.balanceOf(address(round)); vm.prank(admin); round.cancelRound();
        if(poolFirst){vm.prank(admin);round.withdrawPoolIfCancelled();}
        vm.prank(donor1);round.refundMany(_two(a,b));vm.prank(donor2);round.refund(a);
        if(!poolFirst){vm.prank(admin);round.withdrawPoolIfCancelled();}
        assertEq(allIn,x+y+1e6+100e6+extra);assertEq(usdc.balanceOf(address(round)),0);
        assertEq(usdc.balanceOf(donor1),10e6);assertEq(usdc.balanceOf(donor2),10e6);
        assertEq(usdc.balanceOf(admin),100e6+extra);
    }
    function test_GasFinalizeExactly50Projects() public {
        for(uint256 i; i<50; ++i) _registerAndApproveProject(address(uint160(0xC000+i/2)),"Benchmark");
        vm.warp(startTime);
        for(uint160 i; i<10; ++i){
            address user=address(0xB000+i);_verifyUser(user);_fundAndApprove(user,10e6);
            for(uint256 j=1;j<=10;++j){vm.prank(user);round.donate((uint256(i)%5)*10+j,1e6);}
        }
        _fundAndApprove(admin,1000e6);vm.prank(admin);round.depositPool(1000e6);
        assertEq(round.projectCount(),50); vm.warp(endTime); vm.cool(address(round)); vm.prank(admin);
        uint256 beforeGas=gasleft(); round.finalize(); uint256 used=beforeGas-gasleft();
        emit log_named_uint("finalize_50_projects_cold_call_gas",used);
        uint256 paid;for(uint256 i=1;i<=50;++i){assertGt(round.payoutOf(i),0);paid+=round.payoutOf(i);}
        assertLe(paid,round.pool()); assertTrue(round.finalized());
    }

    event PoolUnderfunded(uint256 pool, uint256 totalRaw);

    function test_OwnerProjectLimitAndIndependentOwners() public {
        _registerAndApproveProject(projectOwner1,"A");
        _registerAndApproveProject(projectOwner1,"B");
        vm.prank(projectOwner1); vm.expectRevert(QFRound.OwnerProjectLimit.selector);
        round.registerProject("Spam","D","","");
        _registerAndApproveProject(projectOwner2,"C");
        assertEq(round.projectsOf(projectOwner1),2);
        assertEq(round.projectsOf(projectOwner2),1);
        assertEq(round.projectCount(),3);
    }

    function _rawFixture(uint256 capBps, uint256 funding) internal {
        round = new QFRound("Raw", "Club", admin, address(usdc),startTime,endTime,1e6,225e6,capBps,1000e6,address(registry));
        _registerAndApproveProject(projectOwner1,"300");
        _registerAndApproveProject(projectOwner1,"150");
        _registerAndApproveProject(projectOwner2,"50");
        _verifyUser(donor1); _verifyUser(donor2);
        _fundAndApprove(donor1,1000e6); _fundAndApprove(donor2,1000e6);
        vm.warp(startTime);
        vm.prank(donor1); round.donate(1,100e6);
        vm.prank(donor2); round.donate(1,225e6);
        vm.prank(donor1); round.donate(2,25e6);
        vm.prank(donor2); round.donate(2,225e6);
        vm.prank(donor1); round.donate(3,25e6);
        vm.prank(donor2); round.donate(3,25e6);
        if(funding>0){_fundAndApprove(admin,funding);vm.prank(admin);round.depositPool(funding);}
        assertEq(round.matchingTotalRaw(),500e6);
        vm.warp(endTime);
    }

    function test_UnderfundedProportionalEvent() public {
        _rawFixture(10000,100e6);
        vm.expectEmit(false,false,false,true,address(round)); emit PoolUnderfunded(100e6,500e6);
        vm.prank(admin); round.finalize();
        assertEq(round.payoutOf(1),60e6);assertEq(round.payoutOf(2),30e6);assertEq(round.payoutOf(3),10e6);
        assertEq(round.leftover(),0);
    }
    function test_FundedRawPayoutNoUnderfundedEvent() public {
        _rawFixture(10000,600e6);
        vm.recordLogs(); vm.prank(admin);round.finalize();
        Vm.Log[] memory entries=vm.getRecordedLogs();
        for(uint256 i;i<entries.length;++i) assertTrue(entries[i].topics[0]!=keccak256("PoolUnderfunded(uint256,uint256)"));
        assertEq(round.payoutOf(1),300e6);assertEq(round.payoutOf(2),150e6);assertEq(round.payoutOf(3),50e6);
        assertEq(round.leftover(),100e6);
    }
    function test_UnderfundedCapAndZeroPool() public {
        _rawFixture(2000,100e6);vm.prank(admin);round.finalize();
        assertEq(round.payoutOf(1),20e6);assertEq(round.payoutOf(2),20e6);assertEq(round.payoutOf(3),10e6);assertEq(round.leftover(),50e6);
    }
    function test_ZeroPoolStillReportsRawDemandAndEvent() public {
        _rawFixture(10000,0);
        vm.expectEmit(false,false,false,true,address(round));emit PoolUnderfunded(0,500e6);
        vm.prank(admin);round.finalize();assertEq(round.payoutOf(1),0);assertEq(round.leftover(),0);
    }
    function test_PendingProjectExcludedAndCannotClaim() public {
        _verifyUser(projectOwner1); vm.prank(projectOwner1);uint256 p=round.registerProject("Pending","D","","");
        _verifyUser(donor1);_fundAndApprove(donor1,10e6);vm.warp(startTime);
        vm.prank(donor1);vm.expectRevert(QFRound.ProjectNotApproved.selector);round.donate(p,1e6);
        _fundAndApprove(admin,100e6);vm.prank(admin);round.depositPool(100e6);
        vm.warp(endTime);vm.prank(admin);round.finalize();
        (uint256[] memory ids,)=round.previewMatching();assertEq(ids.length,0);assertEq(round.payoutOf(p),0);assertEq(round.leftover(),100e6);
        vm.prank(projectOwner1);vm.expectRevert(QFRound.ProjectNotApproved.selector);round.claim(p);
    }
    function test_PartialRefundKeepsOtherDonorsAccounting() public {
        (uint256 p,)=_prepare();vm.prank(donor1);round.donate(p,2e6);vm.prank(donor2);round.donate(p,3e6);
        vm.prank(admin);round.cancelRound();vm.prank(donor1);round.refund(p);
        (QFRound.ProjectView[] memory items,)=round.getProjects(0,50);
        assertEq(round.donationOf(donor1,p),0);assertEq(round.spentInRound(donor1),0);
        assertEq(items[0].totalDonated,3e6);assertEq(items[0].donorCount,1);assertEq(items[0].sumSqrt,Math.sqrt(3e6*round.SCALE()));
        assertEq(round.donationOf(donor2,p),3e6);
    }
    function testFuzz_ManyDonorsProjectsRefundToZero(uint8 donorSeed,uint8 projectSeed,uint96 poolSeed) public {
        uint256 nDonors=bound(donorSeed,2,8);uint256 nProjects=bound(projectSeed,1,6);uint256 funding=bound(poolSeed,0,1000e6);
        for(uint160 j;j<nProjects;++j)_registerAndApproveProject(address(0xE000+j/2),"P");
        vm.warp(startTime);
        for(uint160 i;i<nDonors;++i){address user=address(0xF000+i);_verifyUser(user);_fundAndApprove(user,10e6);
            for(uint256 j=1;j<=nProjects;++j){vm.prank(user);round.donate(j,1e6);}}
        if(funding>0){_fundAndApprove(admin,funding);vm.prank(admin);round.depositPool(funding);}
        assertEq(usdc.balanceOf(address(round)),funding+nDonors*nProjects*1e6);
        vm.prank(admin);round.cancelRound();
        uint256[] memory ids=new uint256[](nProjects);for(uint256 j;j<nProjects;++j)ids[j]=j+1;
        for(uint160 i;i<nDonors;++i){address user=address(0xF000+i);vm.prank(user);round.refundMany(ids);assertEq(round.spentInRound(user),0);assertEq(usdc.balanceOf(user),10e6);}
        vm.prank(admin);round.withdrawPoolIfCancelled();assertEq(usdc.balanceOf(address(round)),0);
    }
}
