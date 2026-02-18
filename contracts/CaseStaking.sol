// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { XCase } from "./XCase.sol";

contract CaseStaking is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  IERC20 public immutable caseToken;
  XCase public immutable xCase;

  event Staked(address indexed user, uint256 amount);
  event Unstaked(address indexed user, uint256 amount);

  constructor(address caseTokenAddress, address xCaseAddress) Ownable(msg.sender) {
    require(caseTokenAddress != address(0), "CASE address required");
    require(xCaseAddress != address(0), "xCASE address required");
    caseToken = IERC20(caseTokenAddress);
    xCase = XCase(xCaseAddress);
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount required");
    caseToken.safeTransferFrom(msg.sender, address(this), amount);
    xCase.mint(msg.sender, amount);
    emit Staked(msg.sender, amount);
  }

  function unstake(uint256 amount) external nonReentrant {
    require(amount > 0, "Amount required");
    xCase.burn(msg.sender, amount);
    caseToken.safeTransfer(msg.sender, amount);
    emit Unstaked(msg.sender, amount);
  }
}
