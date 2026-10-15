// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Mock ERC-20 token simulating USDC with 6 decimals and a rate-limited faucet for Fuji testnet.
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;
    uint256 public constant FAUCET_AMOUNT = 100 * 10 ** 6; // 100 USDC
    uint256 public constant FAUCET_COOLDOWN = 1 hours;
    uint256 public constant LIFETIME_CAP = 1000 * 10 ** 6; // 1,000 USDC

    mapping(address => uint256) public lastFaucetMint;
    mapping(address => uint256) public lifetimeMinted;

    error FaucetCooldownActive(uint256 availableAt);
    error FaucetCapExceeded();

    event FaucetMinted(address indexed recipient, uint256 amount);
    event Mint(address indexed to, uint256 amount);

    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Owner mint function with no cap for testing and matching pool funding.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit Mint(to, amount);
    }

    /// @notice Public faucet minting 100 USDC with 1h cooldown and 1,000 USDC lifetime limit.
    function faucetMint() external {
        if (lastFaucetMint[msg.sender] != 0 && block.timestamp < lastFaucetMint[msg.sender] + FAUCET_COOLDOWN) {
            revert FaucetCooldownActive(lastFaucetMint[msg.sender] + FAUCET_COOLDOWN);
        }
        if (lifetimeMinted[msg.sender] + FAUCET_AMOUNT > LIFETIME_CAP) {
            revert FaucetCapExceeded();
        }

        lastFaucetMint[msg.sender] = block.timestamp;
        lifetimeMinted[msg.sender] += FAUCET_AMOUNT;

        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetMinted(msg.sender, FAUCET_AMOUNT);
    }
}

