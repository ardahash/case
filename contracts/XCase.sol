// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract XCase is ERC20, Ownable {
  address public minter;

  modifier onlyMinter() {
    require(msg.sender == minter, "Not minter");
    _;
  }

  constructor() ERC20("Staked Case", "xCASE") Ownable(msg.sender) {}

  function setMinter(address newMinter) external onlyOwner {
    minter = newMinter;
  }

  function mint(address to, uint256 amount) external onlyMinter {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external onlyMinter {
    _burn(from, amount);
  }
}
