// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {StudentRegistry} from "./StudentRegistry.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title QFRound
/// @notice Quadratic funding round for student clubs on Avalanche Fuji.
contract QFRound is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SCALE = 1e12;
    uint256 public constant MAX_PROJECTS = 50;
    uint256 public constant FINALIZE_GRACE = 1 days;

    StudentRegistry public immutable studentRegistry;

    string public name;
    string public organizer;
    address public immutable admin;
    IERC20 public immutable token;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable minDonation;
    uint256 public immutable maxDonation;
    uint256 public immutable maxPerRound;
    mapping(address => uint256) public spentInRound;
    uint256 public immutable maxMatchBps;

    uint256 public pool;
    bool public finalized;
    uint256 public leftover;
    bool public leftoverWithdrawn;
    uint256 public projectCount;

    struct Project {
        address owner;
        string name;
        string description;
        string imageUrl;
        string link;
        bool approved;
        bool claimed;
        uint256 sumSqrt;
        uint256 totalDonated;
        uint256 donorCount;
    }

    struct ProjectView {
        uint256 id;
        address owner;
        string name;
        string description;
        string imageUrl;
        string link;
        bool approved;
        bool claimed;
        uint256 sumSqrt;
        uint256 totalDonated;
        uint256 donorCount;
    }

    mapping(uint256 => Project) private _projects;
    uint256[] public approvedProjectIds;

    // donor => projectId => total donated
    mapping(address => mapping(uint256 => uint256)) public donationOf;

    // Final distribution results
    mapping(uint256 => uint256) public payoutOf;

    // Custom Errors
    error ZeroAddress();
    error InvalidTimeRange();
    error InvalidDonationBounds();
    error InvalidMaxMatchBps();
    error NotAdmin();
    error NotStudent();
    error InvalidRoundBudget();
    error RoundBudgetExceeded();
    error RoundNotActive();
    error RoundEnded();
    error RoundNotEnded();
    error AlreadyFinalized();
    error NotFinalized();
    error ProjectNotApproved();
    error ProjectAlreadyApproved();
    error ProjectNotFound();
    error MaxProjectsReached();
    error SelfDonationNotAllowed();
    error DonationBelowMin();
    error DonationExceedsMax();
    error AlreadyClaimed();
    error NotProjectOwner();
    error LeftoverAlreadyWithdrawn();
    error RoundNameInvalid();
    error OrganizerTooLong();
    error NameLengthInvalid();
    error DescriptionLengthInvalid();
    error UrlTooLong();
    error FinalizeGracePeriodActive();
    error ZeroAmount();

    // Events
    event ProjectRegistered(uint256 indexed id, address indexed owner, string name);
    event ProjectApproved(uint256 indexed id);
    event PoolDeposited(address indexed depositor, uint256 amount, uint256 totalPool);
    event Donated(address indexed donor, uint256 indexed projectId, uint256 amount, uint256 newTotal);
    event Finalized(uint256 totalPayout, uint256 leftover);
    event Claimed(uint256 indexed projectId, address indexed owner, uint256 totalPayout);
    event LeftoverWithdrawn(address indexed admin, uint256 amount);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(
        string memory _name,
        string memory _organizer,
        address _admin,
        address _token,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _minDonation,
        uint256 _maxDonation,
        uint256 _maxMatchBps,
        uint256 _maxPerRound,
        address _studentRegistry
    ) {
        uint256 nameLen = bytes(_name).length;
        if (nameLen == 0 || nameLen > 60) revert RoundNameInvalid();
        if (bytes(_organizer).length > 60) revert OrganizerTooLong();
        if (_admin == address(0) || _token == address(0)) revert ZeroAddress();
        if (_endTime <= _startTime) revert InvalidTimeRange();
        if (_minDonation == 0 || _minDonation > _maxDonation) revert InvalidDonationBounds();
        if (_maxPerRound < _maxDonation) revert InvalidRoundBudget();
        if (_maxMatchBps > 10000) revert InvalidMaxMatchBps();

        if (_studentRegistry == address(0) || _studentRegistry.code.length == 0) revert ZeroAddress();
        studentRegistry = StudentRegistry(_studentRegistry);
        name = _name;
        organizer = _organizer;
        admin = _admin;
        token = IERC20(_token);
        startTime = _startTime;
        endTime = _endTime;
        minDonation = _minDonation;
        maxDonation = _maxDonation;
        maxPerRound = _maxPerRound;
        maxMatchBps = _maxMatchBps;
    }

    /// @notice Compatibility view; StudentRegistry is the only source of student rights.
    function isWhitelisted(address account) public view returns (bool) {
        return studentRegistry.isStudent(account);
    }

    function remainingBudget(address account) external view returns (uint256) {
        return maxPerRound - spentInRound[account];
    }

    // --- Project Registration ---

    /// @notice Globally verified student registers a project before round endTime (max 50 projects).
    function registerProject(
        string calldata name,
        string calldata description,
        string calldata imageUrl,
        string calldata link
    ) external returns (uint256 projectId) {
        if (!studentRegistry.isStudent(msg.sender)) revert NotStudent();
        if (block.timestamp >= endTime) revert RoundEnded();
        if (bytes(name).length == 0 || bytes(name).length > 60) revert NameLengthInvalid();
        if (bytes(description).length == 0 || bytes(description).length > 280) revert DescriptionLengthInvalid();
        if (bytes(imageUrl).length > 200 || bytes(link).length > 200) revert UrlTooLong();
        if (projectCount >= MAX_PROJECTS) revert MaxProjectsReached();

        projectCount++;
        projectId = projectCount;

        _projects[projectId] = Project({
            owner: msg.sender,
            name: name,
            description: description,
            imageUrl: imageUrl,
            link: link,
            approved: false,
            claimed: false,
            sumSqrt: 0,
            totalDonated: 0,
            donorCount: 0
        });

        emit ProjectRegistered(projectId, msg.sender, name);
    }

    /// @notice Admin approves project to participate in round and receive donations.
    function approveProject(uint256 id) external onlyAdmin {
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp >= endTime) revert RoundEnded();
        if (id == 0 || id > projectCount) revert ProjectNotFound();
        if (_projects[id].approved) revert ProjectAlreadyApproved();

        _projects[id].approved = true;
        approvedProjectIds.push(id);

        emit ProjectApproved(id);
    }

    // --- Sponsor Matching Pool ---

    /// @notice Admin deposits matching funds into the pool prior to round finalization.
    function depositPool(uint256 amount) external nonReentrant onlyAdmin {
        if (finalized) revert AlreadyFinalized();
        if (amount == 0) revert ZeroAmount();

        pool += amount;
        emit PoolDeposited(msg.sender, amount, pool);

        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    // --- Student Donations ---

    /// @notice Globally verified student donates minDonation..maxDonation to an approved project.
    function donate(uint256 projectId, uint256 amount) external nonReentrant {
        if (block.timestamp < startTime || block.timestamp >= endTime) revert RoundNotActive();
        if (finalized) revert AlreadyFinalized();
        if (!studentRegistry.isStudent(msg.sender)) revert NotStudent();
        if (projectId == 0 || projectId > projectCount || !_projects[projectId].approved) revert ProjectNotApproved();

        Project storage proj = _projects[projectId];
        if (proj.owner == msg.sender) revert SelfDonationNotAllowed();
        if (amount < minDonation) revert DonationBelowMin();

        uint256 oldTotal = donationOf[msg.sender][projectId];
        uint256 newTotal = oldTotal + amount;
        if (newTotal > maxDonation) revert DonationExceedsMax();
        uint256 newSpent = spentInRound[msg.sender] + amount;
        if (newSpent > maxPerRound) revert RoundBudgetExceeded();
        spentInRound[msg.sender] = newSpent;

        if (oldTotal == 0) {
            proj.donorCount++;
        }

        uint256 oldSqrt = oldTotal > 0 ? Math.sqrt(oldTotal * SCALE) : 0;
        uint256 newSqrt = Math.sqrt(newTotal * SCALE);

        proj.sumSqrt = proj.sumSqrt + newSqrt - oldSqrt;
        proj.totalDonated += amount;
        donationOf[msg.sender][projectId] = newTotal;

        emit Donated(msg.sender, projectId, amount, newTotal);

        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    // --- Matching Math & Finalization ---

    /// @dev Internal calculation of quadratic matching allocations. Shared with previewMatching().
    function _computeMatching()
        internal
        view
        returns (
            uint256[] memory projectIds,
            uint256[] memory payouts,
            uint256 totalPayout,
            uint256 remainingLeftover
        )
    {
        uint256 n = approvedProjectIds.length;
        projectIds = approvedProjectIds;
        payouts = new uint256[](n);

        if (n == 0 || pool == 0) {
            return (projectIds, payouts, 0, pool);
        }

        uint256[] memory raw = new uint256[](n);
        uint256 sumRaw = 0;

        for (uint256 i = 0; i < n; i++) {
            uint256 pId = approvedProjectIds[i];
            Project storage proj = _projects[pId];

            uint256 s = proj.sumSqrt;
            uint256 sSquaredScaled = (s * s) / SCALE;
            uint256 totalD = proj.totalDonated;

            if (sSquaredScaled > totalD) {
                raw[i] = sSquaredScaled - totalD;
                sumRaw += raw[i];
            } else {
                raw[i] = 0;
            }
        }

        uint256 cap = (pool * maxMatchBps) / 10000;
        totalPayout = 0;

        for (uint256 i = 0; i < n; i++) {
            uint256 p;
            if (sumRaw == 0) {
                p = 0;
            } else if (sumRaw > pool) {
                p = (pool * raw[i]) / sumRaw;
            } else {
                p = raw[i];
            }

            if (p > cap) {
                p = cap;
            }

            payouts[i] = p;
            totalPayout += p;
        }

        remainingLeftover = pool - totalPayout;
    }

    /// @notice Returns current estimated matching payout for each approved project using exact finalize math.
    function previewMatching() external view returns (uint256[] memory projectIds, uint256[] memory estimatedPayouts) {
        (projectIds, estimatedPayouts, , ) = _computeMatching();
    }

    /// @notice Finalize the round after endTime. Only admin can finalize during FINALIZE_GRACE (1 day); after that anyone can.
    function finalize() external nonReentrant {
        if (block.timestamp < endTime) revert RoundNotEnded();
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp < endTime + FINALIZE_GRACE && msg.sender != admin) {
            revert FinalizeGracePeriodActive();
        }

        finalized = true;

        (uint256[] memory pIds, uint256[] memory payouts, uint256 totalPayout, uint256 remainingLeftover) =
            _computeMatching();

        for (uint256 i = 0; i < pIds.length; i++) {
            payoutOf[pIds[i]] = payouts[i];
        }

        leftover = remainingLeftover;

        emit Finalized(totalPayout, leftover);
    }

    /// @notice Project owner claims direct donations plus matching payout after finalize.
    function claim(uint256 projectId) external nonReentrant {
        if (!finalized) revert NotFinalized();
        if (projectId == 0 || projectId > projectCount) revert ProjectNotFound();

        Project storage proj = _projects[projectId];
        if (msg.sender != proj.owner) revert NotProjectOwner();
        if (!proj.approved) revert ProjectNotApproved();
        if (proj.claimed) revert AlreadyClaimed();

        proj.claimed = true;

        uint256 totalPayout = proj.totalDonated + payoutOf[projectId];
        emit Claimed(projectId, msg.sender, totalPayout);

        if (totalPayout > 0) {
            token.safeTransfer(msg.sender, totalPayout);
        }
    }

    /// @notice Admin withdraws unallocated leftover pool funds after finalize.
    function withdrawLeftover() external nonReentrant onlyAdmin {
        if (!finalized) revert NotFinalized();
        if (leftoverWithdrawn) revert LeftoverAlreadyWithdrawn();

        leftoverWithdrawn = true;
        uint256 amount = leftover;
        emit LeftoverWithdrawn(admin, amount);

        if (amount > 0) {
            token.safeTransfer(admin, amount);
        }
    }

    // --- Frontend Views (No Event Scanning Required) ---

    function getProject(uint256 id)
        external
        view
        returns (
            address owner,
            string memory name,
            string memory description,
            string memory imageUrl,
            string memory link,
            bool approved,
            bool claimed,
            uint256 sumSqrt,
            uint256 totalDonated,
            uint256 donorCount
        )
    {
        if (id == 0 || id > projectCount) revert ProjectNotFound();
        Project storage proj = _projects[id];
        return (
            proj.owner,
            proj.name,
            proj.description,
            proj.imageUrl,
            proj.link,
            proj.approved,
            proj.claimed,
            proj.sumSqrt,
            proj.totalDonated,
            proj.donorCount
        );
    }

    function getProjects(uint256 offset, uint256 limit)
        external
        view
        returns (ProjectView[] memory items, uint256 total)
    {
        total = projectCount;
        if (offset >= total || limit == 0) {
            return (new ProjectView[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;

        items = new ProjectView[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 id = offset + i + 1;
            Project storage proj = _projects[id];
            items[i] = ProjectView({
                id: id,
                owner: proj.owner,
                name: proj.name,
                description: proj.description,
                imageUrl: proj.imageUrl,
                link: proj.link,
                approved: proj.approved,
                claimed: proj.claimed,
                sumSqrt: proj.sumSqrt,
                totalDonated: proj.totalDonated,
                donorCount: proj.donorCount
            });
        }
    }

}
