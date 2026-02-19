// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IXCaseStaking {
  function stakedBalance(address user) external view returns (uint256);
}

contract BasedRoomRewards is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  IERC20 public immutable rewardToken;
  IERC20 public immutable xCase;
  IXCaseStaking public immutable xCaseStaking;

  uint256 public constant REWARD_PER_DAY = 2; // 2 sats (reward token uses 8 decimals)
  uint256 public constant REQUIRED_STAKE = 10_000 * 1e18;

  mapping(address => uint256) public lastClaim;

  event Claimed(address indexed user, uint256 amount);
  event Funded(address indexed sender, uint256 amount);

  constructor(
    address rewardTokenAddress,
    address xCaseAddress,
    address xCaseStakingAddress
  ) Ownable(msg.sender) {
    require(rewardTokenAddress != address(0), "Reward token required");
    require(xCaseAddress != address(0), "xCASE required");
    require(xCaseStakingAddress != address(0), "xCASE staking required");
    rewardToken = IERC20(rewardTokenAddress);
    xCase = IERC20(xCaseAddress);
    xCaseStaking = IXCaseStaking(xCaseStakingAddress);
  }

  function eligibleStake(address user) public view returns (uint256) {
    return xCase.balanceOf(user) + xCaseStaking.stakedBalance(user);
  }

  function isEligible(address user) public view returns (bool) {
    return eligibleStake(user) >= REQUIRED_STAKE;
  }

  function pendingRewards(address user) public view returns (uint256) {
    if (!isEligible(user)) return 0;
    uint256 last = lastClaim[user];
    if (last == 0) return REWARD_PER_DAY;
    uint256 daysElapsed = (block.timestamp - last) / 1 days;
    if (daysElapsed == 0) return 0;
    return daysElapsed * REWARD_PER_DAY;
  }

  function claim() external nonReentrant {
    require(isEligible(msg.sender), "Not eligible");
    uint256 reward = pendingRewards(msg.sender);
    require(reward > 0, "Nothing to claim");
    lastClaim[msg.sender] = block.timestamp;
    rewardToken.safeTransfer(msg.sender, reward);
    emit Claimed(msg.sender, reward);
  }

  function fund(uint256 amount) external onlyOwner {
    require(amount > 0, "Amount required");
    rewardToken.safeTransferFrom(msg.sender, address(this), amount);
    emit Funded(msg.sender, amount);
  }
}
