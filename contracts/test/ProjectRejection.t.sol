// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {QFRoundTest} from "./QFRound.t.sol";
import {QFRound} from "../src/QFRound.sol";

contract ProjectRejectionTest is QFRoundTest {
    event ProjectRejected(uint256 indexed id);
    function _pending(address owner) internal returns (uint256 id) {
        _verifyUser(owner);
        vm.prank(owner);
        return round.registerProject("Pending", "Description", "image", "link");
    }
    function test_AdminRejectsAndEmitsWithoutDeletingRecord() public {
        uint256 id = _pending(projectOwner1);
        vm.expectEmit(true, false, false, true, address(round)); emit ProjectRejected(id);
        vm.prank(admin); round.rejectProject(id);
        assertTrue(round.rejected(id));
        (address owner, string memory title,,,,bool approved,,,,,bool isRejected) = round.getProject(id);
        assertEq(owner, projectOwner1); assertEq(title, "Pending"); assertFalse(approved); assertTrue(isRejected);
        (QFRound.ProjectView[] memory projects, uint256 total) = round.getProjects(0,50);
        assertEq(total,1); assertEq(projects[0].id,id); assertTrue(projects[0].rejected);
        assertEq(projects[0].description,"Description"); assertEq(projects[0].imageUrl,"image"); assertEq(projects[0].link,"link");
    }
    function test_RejectAccessAndInvalidIds() public {
        uint256 id = _pending(projectOwner1);
        vm.prank(projectOwner1); vm.expectRevert(QFRound.NotAdmin.selector); round.rejectProject(id);
        vm.prank(admin); vm.expectRevert(QFRound.ProjectNotFound.selector); round.rejectProject(0);
        vm.prank(admin); vm.expectRevert(QFRound.ProjectNotFound.selector); round.rejectProject(id+1);
    }
    function test_RejectApprovedAndRepeatedRejectionAndApproveRejected() public {
        uint256 approved = _registerAndApproveProject(projectOwner1,"Approved");
        vm.prank(admin); vm.expectRevert(QFRound.ProjectAlreadyApproved.selector); round.rejectProject(approved);
        uint256 id = _pending(projectOwner2);
        vm.prank(admin); round.rejectProject(id);
        vm.prank(admin); vm.expectRevert(QFRound.ProjectAlreadyRejected.selector); round.rejectProject(id);
        vm.prank(admin); vm.expectRevert(QFRound.ProjectAlreadyRejected.selector); round.approveProject(id);
        assertFalse(round.rejected(approved));
    }
    function test_RejectedCannotDonateBatchMatchOrClaim() public {
        uint256 good = _registerAndApproveProject(projectOwner1,"Good");
        uint256 bad = _pending(projectOwner2);
        vm.prank(admin); round.rejectProject(bad);
        _verifyUser(donor1); _verifyUser(donor2); _fundAndApprove(donor1,10e6); _fundAndApprove(donor2,10e6);
        vm.warp(startTime);
        vm.prank(donor1); vm.expectRevert(QFRound.ProjectNotApproved.selector); round.donate(bad,1e6);
        uint256[] memory ids = new uint256[](2); ids[0]=good; ids[1]=bad;
        uint256[] memory amounts = new uint256[](2); amounts[0]=1e6; amounts[1]=1e6;
        vm.prank(donor1); vm.expectRevert(QFRound.ProjectNotApproved.selector); round.donateMany(ids,amounts);
        assertEq(round.spentInRound(donor1),0); assertEq(round.donationOf(donor1,good),0);
        vm.prank(donor1); round.donate(good,1e6); vm.prank(donor2); round.donate(good,1e6);
        _fundAndApprove(admin,10e6); vm.prank(admin); round.depositPool(10e6);
        (uint256[] memory previewIds, uint256[] memory preview) = round.previewMatching();
        assertEq(previewIds.length,1); assertEq(previewIds[0],good); assertEq(preview[0],2e6);
        assertEq(round.matchingTotalRaw(),2e6);
        vm.warp(endTime); vm.prank(admin); round.finalize();
        assertEq(round.payoutOf(bad),0); assertEq(round.payoutOf(good),2e6); assertEq(round.leftover(),8e6);
        vm.prank(projectOwner2); vm.expectRevert(QFRound.ProjectNotApproved.selector); round.claim(bad);
        vm.prank(projectOwner1); round.claim(good); assertEq(usdc.balanceOf(projectOwner1),4e6);
    }
    function test_CannotRejectAfterFinalizeOrCancellation() public {
        uint256 id = _pending(projectOwner1);
        uint256 snapshot = vm.snapshotState();
        vm.warp(endTime); vm.prank(admin); round.finalize();
        vm.prank(admin); vm.expectRevert(QFRound.AlreadyFinalized.selector); round.rejectProject(id);
        vm.revertToState(snapshot); vm.prank(admin); round.cancelRound();
        vm.prank(admin); vm.expectRevert(QFRound.RoundIsCancelled.selector); round.rejectProject(id);
    }
    function test_RejectionKeepsOwnerAndRoundCapacity() public {
        uint256 first = _pending(projectOwner1); _pending(projectOwner1);
        vm.prank(admin); round.rejectProject(first);
        assertEq(round.projectCount(),2); assertEq(round.projectsOf(projectOwner1),2);
        vm.prank(projectOwner1); vm.expectRevert(QFRound.OwnerProjectLimit.selector);
        round.registerProject("Third","Description","","");
        for(uint160 i; i<48; ++i) _pending(address(0xC000+i/2));
        assertEq(round.projectCount(),50);
        vm.prank(admin); round.rejectProject(50);
        _verifyUser(projectOwner2); vm.prank(projectOwner2); vm.expectRevert(QFRound.MaxProjectsReached.selector);
        round.registerProject("Overflow","Description","","");
        assertEq(round.projectCount(),50); assertEq(round.projectsOf(projectOwner1),2);
    }
}
