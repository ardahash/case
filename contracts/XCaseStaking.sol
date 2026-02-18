// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract XCaseStaking is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  IERC20 public immutable xCase;
  IERC20 public immutable rewardToken;

  uint256 public constant ACC_PRECISION = 1e12;
  uint256 public accRewardPerShare;
  uint256 public totalStaked;
  uint256 public unallocatedRewards;

  mapping(address => uint256) public stakedBalance;
  mapping(address => uint256) public rewardDebt;

  event Staked(address indexed user, uint256 amount);
  event Unstaked(address indexed user, uint256 amount);
  event RewardClaimed(address indexed user, uint256 amount);
  event RewardNotified(uint256 amount);

  constructor(address xCaseAddress, address rewardTokenAddress) Ownable(msg.sender) {
    require(xCaseAddress != address(0), "xCASE address required");
    require(rewardTokenAddress != address(0), "Reward token address required");
    xCase = IERC20(xCaseAddress);
    rewardToken = IERC20(rewardTokenAddress);
  }

  function pendingRewards(address user) public view returns (uint256) {
    uint256 currentAcc = accRewardPerShare;
    if (totalStaked > 0 && unallocatedRewards > 0) {
      currentAcc += (unallocatedRewards * ACC_PRECISION) / totalStaked;
    }
    return (stakedBalance[user] * currentAcc) / ACC_PRECISION - rewardDebt[user];
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount required");
    _updateAccRewardPerShare();
    _harvest(msg.sender);

    xCase.safeTransferFrom(msg.sender, address(this), amount);
    stakedBalance[msg.sender] += amount;
    totalStaked += amount;
    rewardDebt[msg.sender] = (stakedBalance[msg.sender] * accRewardPerShare) / ACC_PRECISION;

    emit Staked(msg.sender, amount);
  }

  function unstake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount required");
    require(stakedBalance[msg.sender] >= amount, "Insufficient stake");

    _updateAccRewardPerShare();
    _harvest(msg.sender);

    stakedBalance[msg.sender] -= amount;
    totalStaked -= amount;
    rewardDebt[msg.sender] = (stakedBalance[msg.sender] * accRewardPerShare) / ACC_PRECISION;

    xCase.safeTransfer(msg.sender, amount);

    emit Unstaked(msg.sender, amount);
  }

  function claim() external nonReentrant {
    _updateAccRewardPerShare();
    _harvest(msg.sender);
    rewardDebt[msg.sender] = (stakedBalance[msg.sender] * accRewardPerShare) / ACC_PRECISION;
  }

  function notifyRewardAmount(uint256 amount) external onlyOwner {
    require(amount > 0, "Amount required");
    rewardToken.safeTransferFrom(msg.sender, address(this), amount);

    if (totalStaked == 0) {
      unallocatedRewards += amount;
    } else {
      accRewardPerShare += (amount * ACC_PRECISION) / totalStaked;
    }

    emit RewardNotified(amount);
  }

  function _updateAccRewardPerShare() internal {
    if (totalStaked > 0 && unallocatedRewards > 0) {
      accRewardPerShare += (unallocatedRewards * ACC_PRECISION) / totalStaked;
      unallocatedRewards = 0;
    }
  }

  function _harvest(address user) internal {
    uint256 pending = (stakedBalance[user] * accRewardPerShare) / ACC_PRECISION - rewardDebt[user];
    if (pending > 0) {
      rewardToken.safeTransfer(user, pending);
      emit RewardClaimed(user, pending);
    }
  }
}
