// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title QFRound
/// @notice Quadratic funding round for student clubs on Avalanche Fuji.
contract QFRound is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SCALE = 1e12;
    uint256 public constant MAX_PROJECTS = 50;
    uint256 public constant MAX_REQUESTERS = 500;
    uint256 public constant MAX_BATCH_SIZE = 50;

    address public immutable admin;
    IERC20 public immutable token;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public immutable minDonation;
    uint256 public immutable maxDonation;
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

    // Whitelist & pending verification
    mapping(address => bool) public isWhitelisted;
    mapping(address => bool) public requested;
    address[] private _requesters;
    mapping(address => uint256) private _requesterIndex; // 1-indexed

    // Final distribution results
    mapping(uint256 => uint256) public payoutOf;

    // Custom Errors
    error ZeroAddress();
    error InvalidTimeRange();
    error InvalidDonationBounds();
    error InvalidMaxMatchBps();
    error NotAdmin();
    error NotWhitelisted();
    error AlreadyWhitelisted();
    error AlreadyRequested();
    error MaxRequestersReached();
    error BatchTooLarge();
    error BatchLengthMismatch();
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
    error NameLengthInvalid();
    error DescriptionLengthInvalid();
    error UrlTooLong();

    // Events
    event VerificationRequested(address indexed requester);
    event WhitelistUpdated(address indexed account, bool status);
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
        address _admin,
        address _token,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _minDonation,
        uint256 _maxDonation,
        uint256 _maxMatchBps
    ) {
        if (_admin == address(0) || _token == address(0)) revert ZeroAddress();
        if (_endTime <= _startTime) revert InvalidTimeRange();
        if (_minDonation == 0 || _minDonation > _maxDonation) revert InvalidDonationBounds();
        if (_maxMatchBps > 10000) revert InvalidMaxMatchBps();

        admin = _admin;
        token = IERC20(_token);
        startTime = _startTime;
        endTime = _endTime;
        minDonation = _minDonation;
        maxDonation = _maxDonation;
        maxMatchBps = _maxMatchBps;
    }

    // --- Whitelist Management ---

    /// @notice Request student wallet verification. Bounded to max 500 pending requesters.
    function requestVerification() external {
        if (isWhitelisted[msg.sender]) revert AlreadyWhitelisted();
        if (requested[msg.sender]) revert AlreadyRequested();
        if (_requesters.length >= MAX_REQUESTERS) revert MaxRequestersReached();

        requested[msg.sender] = true;
        _requesters.push(msg.sender);
        _requesterIndex[msg.sender] = _requesters.length;

        emit VerificationRequested(msg.sender);
    }

    /// @notice Admin approves or rejects student wallet. Both outcomes remove address from pending queue.
    function setWhitelist(address account, bool status) public onlyAdmin {
        if (account == address(0)) revert ZeroAddress();

        isWhitelisted[account] = status;

        if (requested[account]) {
            _removeRequester(account);
        }

        emit WhitelistUpdated(account, status);
    }

    /// @notice Batch whitelist approval/rejection up to 50 addresses per call.
    function setWhitelistBatch(address[] calldata accounts, bool[] calldata statuses) external onlyAdmin {
        if (accounts.length > MAX_BATCH_SIZE) revert BatchTooLarge();
        if (accounts.length != statuses.length) revert BatchLengthMismatch();

        for (uint256 i = 0; i < accounts.length; i++) {
            setWhitelist(accounts[i], statuses[i]);
        }
    }

    function _removeRequester(address account) internal {
        uint256 idx = _requesterIndex[account];
        if (idx != 0) {
            uint256 lastIdx = _requesters.length;
            if (idx != lastIdx) {
                address lastAccount = _requesters[lastIdx - 1];
                _requesters[idx - 1] = lastAccount;
                _requesterIndex[lastAccount] = idx;
            }
            _requesters.pop();
            delete _requesterIndex[account];
            requested[account] = false;
        }
    }

    // --- Project Registration ---

    /// @notice Anyone can register a project before round endTime (max 50 projects).
    function registerProject(
        string calldata name,
        string calldata description,
        string calldata imageUrl,
        string calldata link
    ) external returns (uint256 projectId) {
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
        if (amount == 0) revert DonationBelowMin();

        pool += amount;
        emit PoolDeposited(msg.sender, amount, pool);

        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    // --- Student Donations ---

    /// @notice Whitelisted student donates minDonation..maxDonation to an approved project.
    function donate(uint256 projectId, uint256 amount) external nonReentrant {
        if (block.timestamp < startTime || block.timestamp >= endTime) revert RoundNotActive();
        if (finalized) revert AlreadyFinalized();
        if (!isWhitelisted[msg.sender]) revert NotWhitelisted();
        if (projectId == 0 || projectId > projectCount || !_projects[projectId].approved) revert ProjectNotApproved();

        Project storage proj = _projects[projectId];
        if (proj.owner == msg.sender) revert SelfDonationNotAllowed();
        if (amount < minDonation) revert DonationBelowMin();

        uint256 oldTotal = donationOf[msg.sender][projectId];
        uint256 newTotal = oldTotal + amount;
        if (newTotal > maxDonation) revert DonationExceedsMax();

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

    /// @notice Finalize the round after endTime. Loops over approved projects only.
    function finalize() external nonReentrant {
        if (block.timestamp < endTime) revert RoundNotEnded();
        if (finalized) revert AlreadyFinalized();

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

    function getRequesters(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory items, uint256 total)
    {
        total = _requesters.length;
        if (offset >= total || limit == 0) {
            return (new address[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        uint256 count = end - offset;

        items = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            items[i] = _requesters[offset + i];
        }
    }
}
