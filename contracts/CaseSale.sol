// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract CaseSale is ReentrancyGuard, Ownable {
  using SafeERC20 for IERC20;

  uint256 public constant USD_SCALE = 1e6;
  uint256 public constant CBBTC_SCALE = 1e8;

  struct CaseType {
    uint256 priceUSDC; // 6 decimals
    uint256 minRewardUsd; // 6 decimals
    uint256 maxRewardUsd; // 6 decimals
    uint16 positiveReturnBps; // 0 - 10000
    bool enabled;
  }

  struct Opening {
    address buyer;
    uint256 caseTypeId;
    address rewardToken;
    uint256 rewardAmount;
    uint256 reservedAmount;
    uint256 btcUsdPrice;
    bool rewarded;
    bool claimed;
  }

  IERC20 public immutable usdc;
  IERC20 public immutable cbBtc;
  IERC20 public immutable caseToken;
  AggregatorV3Interface public immutable btcUsdFeed;
  uint8 public immutable btcUsdDecimals;
  uint256 public immutable btcUsdScale;
  address public treasury;

  uint256 public nextOpeningId;
  uint256 public reservedCbBtcReward;
  uint256 public reservedCaseReward;
  uint256 public maxPriceAge;
  uint256 public dailyCaseTypeId;
  uint256 public dailyCooldown = 1 days;
  uint16 public dailyCaseCaseBps;
  uint256 public dailyCaseCaseMin;
  uint256 public dailyCaseCaseMax;
  uint256 public dailyCaseCbBtcMin;
  uint256 public dailyCaseCbBtcMax;

  mapping(uint256 => CaseType) public caseTypes;
  mapping(uint256 => Opening) public openings;
  mapping(address => uint256) public lastDailyOpen;

  event CaseTypeUpdated(
    uint256 indexed caseTypeId,
    uint256 priceUSDC,
    uint256 minRewardUsd,
    uint256 maxRewardUsd,
    uint16 positiveReturnBps,
    bool enabled
  );
  event CasePurchased(address indexed buyer, uint256 indexed caseTypeId, uint256 indexed openingId, uint256 priceUSDC);
  event CaseRewarded(uint256 indexed openingId, uint256 rewardAmount);
  event CaseClaimed(uint256 indexed openingId, address indexed buyer, uint256 rewardAmount);
  event TreasuryUpdated(address indexed treasury);
  event MaxPriceAgeUpdated(uint256 maxPriceAge);
  event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
  event DailyCaseConfigured(uint256 caseTypeId, uint256 cooldownSeconds);
  event DailyCaseRewardsUpdated(
    uint16 caseBps,
    uint256 caseMin,
    uint256 caseMax,
    uint256 cbBtcMin,
    uint256 cbBtcMax
  );

  constructor(
    address usdcAddress,
    address cbBtcAddress,
    address caseTokenAddress,
    address btcUsdFeedAddress,
    address treasuryAddress
  ) Ownable(msg.sender) {
    require(usdcAddress != address(0), "USDC address required");
    require(cbBtcAddress != address(0), "cbBTC address required");
    require(caseTokenAddress != address(0), "CASE address required");
    require(btcUsdFeedAddress != address(0), "BTC/USD feed required");
    require(treasuryAddress != address(0), "Treasury address required");

    usdc = IERC20(usdcAddress);
    cbBtc = IERC20(cbBtcAddress);
    caseToken = IERC20(caseTokenAddress);
    btcUsdFeed = AggregatorV3Interface(btcUsdFeedAddress);
    btcUsdDecimals = btcUsdFeed.decimals();
    btcUsdScale = 10 ** btcUsdDecimals;
    treasury = treasuryAddress;
    maxPriceAge = 1 days;
  }

  function setTreasury(address newTreasury) external onlyOwner {
    require(newTreasury != address(0), "Treasury address required");
    treasury = newTreasury;
    emit TreasuryUpdated(newTreasury);
  }

  function setMaxPriceAge(uint256 newMaxPriceAge) external onlyOwner {
    require(newMaxPriceAge > 0, "Max age required");
    maxPriceAge = newMaxPriceAge;
    emit MaxPriceAgeUpdated(newMaxPriceAge);
  }

  function setDailyCase(uint256 caseTypeId, uint256 cooldownSeconds) external onlyOwner {
    dailyCaseTypeId = caseTypeId;
    if (cooldownSeconds > 0) {
      dailyCooldown = cooldownSeconds;
    }
    emit DailyCaseConfigured(caseTypeId, dailyCooldown);
  }

  function setDailyCaseRewards(
    uint16 caseBps,
    uint256 caseMin,
    uint256 caseMax,
    uint256 cbBtcMin,
    uint256 cbBtcMax
  ) external onlyOwner {
    require(caseBps <= 10000, "Invalid BPS");
    require(caseMax >= caseMin, "Invalid CASE range");
    require(cbBtcMax >= cbBtcMin, "Invalid cbBTC range");
    dailyCaseCaseBps = caseBps;
    dailyCaseCaseMin = caseMin;
    dailyCaseCaseMax = caseMax;
    dailyCaseCbBtcMin = cbBtcMin;
    dailyCaseCbBtcMax = cbBtcMax;
    emit DailyCaseRewardsUpdated(caseBps, caseMin, caseMax, cbBtcMin, cbBtcMax);
  }

  function setCaseType(
    uint256 caseTypeId,
    uint256 priceUSDC,
    uint256 minRewardUsd,
    uint256 maxRewardUsd,
    uint16 positiveReturnBps,
    bool enabled
  ) external onlyOwner {
    require(maxRewardUsd >= minRewardUsd, "Invalid reward range");
    if (priceUSDC != 0) {
      require(priceUSDC >= minRewardUsd && priceUSDC <= maxRewardUsd, "Price outside range");
    }
    require(positiveReturnBps <= 10000, "Invalid BPS");
    caseTypes[caseTypeId] = CaseType({
      priceUSDC: priceUSDC,
      minRewardUsd: minRewardUsd,
      maxRewardUsd: maxRewardUsd,
      positiveReturnBps: positiveReturnBps,
      enabled: enabled
    });
    emit CaseTypeUpdated(caseTypeId, priceUSDC, minRewardUsd, maxRewardUsd, positiveReturnBps, enabled);
  }

  function availableCases(uint256 caseTypeId) public view returns (uint256) {
    CaseType memory caseType = caseTypes[caseTypeId];
    if (!caseType.enabled) {
      return 0;
    }
    if (caseTypeId == dailyCaseTypeId && dailyCaseTypeId != 0) {
      uint256 availableCase = 0;
      uint256 availableCbBtc = 0;

      if (dailyCaseCaseBps > 0 && dailyCaseCaseMax > 0) {
        uint256 caseBalance = caseToken.balanceOf(address(this));
        if (caseBalance > reservedCaseReward) {
          availableCase = (caseBalance - reservedCaseReward) / dailyCaseCaseMax;
        }
      }

      if (dailyCaseCaseBps < 10000 && dailyCaseCbBtcMax > 0) {
        uint256 cbBtcBalance = cbBtc.balanceOf(address(this));
        if (cbBtcBalance > reservedCbBtcReward) {
          availableCbBtc = (cbBtcBalance - reservedCbBtcReward) / dailyCaseCbBtcMax;
        }
      }

      if (dailyCaseCaseBps == 10000) {
        return availableCase;
      }
      if (dailyCaseCaseBps == 0) {
        return availableCbBtc;
      }
      return availableCase < availableCbBtc ? availableCase : availableCbBtc;
    }
    if (caseType.maxRewardUsd == 0) {
      return 0;
    }
    uint256 price = _getBtcUsdPrice();
    uint256 maxReward = _usdToCbBtc(caseType.maxRewardUsd, price);
    if (maxReward == 0) {
      return 0;
    }
    uint256 balance = cbBtc.balanceOf(address(this));
    if (balance <= reservedCbBtcReward) {
      return 0;
    }
    return (balance - reservedCbBtcReward) / maxReward;
  }

  function purchaseCase(uint256 caseTypeId) external nonReentrant returns (uint256 openingId) {
    CaseType memory caseType = caseTypes[caseTypeId];
    require(caseType.enabled, "Case disabled");
    bool isDaily = caseTypeId == dailyCaseTypeId && dailyCaseTypeId != 0;
    if (isDaily) {
      uint256 lastOpen = lastDailyOpen[msg.sender];
      require(block.timestamp - lastOpen >= dailyCooldown, "Daily case cooldown");
      lastDailyOpen[msg.sender] = block.timestamp;
    } else {
      require(caseType.priceUSDC > 0, "Case not found");
    }

    uint256 btcUsdPrice = _getBtcUsdPrice();

    openingId = ++nextOpeningId;
    if (isDaily) {
      uint256 dailyRandomBase = _pseudoRandom(openingId, caseTypeId);
      bool caseReward = dailyCaseCaseBps > 0 &&
        (dailyCaseCaseBps == 10000 || (dailyRandomBase % 10000) < dailyCaseCaseBps);

      address rewardToken = caseReward ? address(caseToken) : address(cbBtc);
      uint256 rewardAmount = caseReward
        ? _randomRange(dailyRandomBase, dailyCaseCaseMin, dailyCaseCaseMax)
        : _randomRange(dailyRandomBase, dailyCaseCbBtcMin, dailyCaseCbBtcMax);

      require(rewardAmount > 0, "Daily reward unset");

      if (caseReward) {
        uint256 caseBalance = caseToken.balanceOf(address(this));
        require(caseBalance >= reservedCaseReward + rewardAmount, "Insufficient CASE");
        reservedCaseReward += rewardAmount;
      } else {
        uint256 cbBtcBalance = cbBtc.balanceOf(address(this));
        require(cbBtcBalance >= reservedCbBtcReward + rewardAmount, "Insufficient cbBTC");
        reservedCbBtcReward += rewardAmount;
      }

      openings[openingId] = Opening({
        buyer: msg.sender,
        caseTypeId: caseTypeId,
        rewardToken: rewardToken,
        rewardAmount: rewardAmount,
        reservedAmount: rewardAmount,
        btcUsdPrice: caseReward ? 0 : btcUsdPrice,
        rewarded: true,
        claimed: false
      });

      emit CasePurchased(msg.sender, caseTypeId, openingId, caseType.priceUSDC);
      emit CaseRewarded(openingId, rewardAmount);
      return openingId;
    }

    uint256 maxReward = _usdToCbBtc(caseType.maxRewardUsd, btcUsdPrice);
    require(maxReward > 0, "Price too low");

    uint256 balance = cbBtc.balanceOf(address(this));
    require(balance >= reservedCbBtcReward + maxReward, "Sold out");

    if (caseType.priceUSDC > 0) {
      usdc.safeTransferFrom(msg.sender, treasury, caseType.priceUSDC);
    }

    reservedCbBtcReward += maxReward;
    openings[openingId] = Opening({
      buyer: msg.sender,
      caseTypeId: caseTypeId,
      rewardToken: address(cbBtc),
      rewardAmount: 0,
      reservedAmount: maxReward,
      btcUsdPrice: btcUsdPrice,
      rewarded: false,
      claimed: false
    });

    uint256 randomBase = _pseudoRandom(openingId, caseTypeId);
    _finalizeReward(openingId, randomBase);

    emit CasePurchased(msg.sender, caseTypeId, openingId, caseType.priceUSDC);
    return openingId;
  }

  function claimReward(uint256 openingId) external nonReentrant {
    Opening storage opening = openings[openingId];
    require(opening.buyer == msg.sender, "Not opener");
    require(opening.rewarded, "Reward not ready");
    require(!opening.claimed, "Already claimed");

    opening.claimed = true;
    if (opening.reservedAmount > 0) {
      if (opening.rewardToken == address(caseToken)) {
        reservedCaseReward -= opening.reservedAmount;
      } else {
        reservedCbBtcReward -= opening.reservedAmount;
      }
      opening.reservedAmount = 0;
    }
    IERC20(opening.rewardToken).safeTransfer(msg.sender, opening.rewardAmount);

    emit CaseClaimed(openingId, msg.sender, opening.rewardAmount);
  }

  function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
    require(token != address(0), "Token required");
    address recipient = to == address(0) ? treasury : to;
    require(recipient != address(0), "Recipient required");
    uint256 balance = IERC20(token).balanceOf(address(this));
    uint256 withdrawAmount = amount == 0 ? balance : amount;
    require(withdrawAmount <= balance, "Insufficient balance");
    IERC20(token).safeTransfer(recipient, withdrawAmount);
    emit EmergencyWithdraw(token, recipient, withdrawAmount);
  }

  function getOpening(uint256 openingId) external view returns (Opening memory) {
    return openings[openingId];
  }

  function _getBtcUsdPrice() internal view returns (uint256) {
    (uint80 roundId, int256 answer, , uint256 updatedAt, uint80 answeredInRound) =
      btcUsdFeed.latestRoundData();
    require(answer > 0, "Bad price");
    require(updatedAt != 0, "Bad price");
    require(answeredInRound >= roundId, "Stale price");
    require(block.timestamp - updatedAt <= maxPriceAge, "Stale price");
    return uint256(answer);
  }

  function _usdToCbBtc(uint256 usdAmount, uint256 btcUsdPrice) internal view returns (uint256) {
    uint256 numerator = usdAmount * CBBTC_SCALE * btcUsdScale;
    return numerator / btcUsdPrice / USD_SCALE;
  }

  function _pseudoRandom(uint256 openingId, uint256 caseTypeId) internal view returns (uint256) {
    return uint256(
      keccak256(
        abi.encodePacked(
          block.prevrandao,
          blockhash(block.number - 1),
          msg.sender,
          openingId,
          caseTypeId,
          address(this)
        )
      )
    );
  }

  function _finalizeReward(uint256 openingId, uint256 randomBase) internal {
    Opening storage opening = openings[openingId];
    require(opening.buyer != address(0), "Opening not found");
    require(!opening.rewarded, "Already rewarded");

    CaseType memory caseType = caseTypes[opening.caseTypeId];
    uint256 rewardAmount;

    if (caseType.positiveReturnBps > 0) {
      uint256 selector = randomBase % 10000;
      uint256 rewardRand = uint256(keccak256(abi.encode(randomBase, openingId)));
      if (selector < caseType.positiveReturnBps) {
        rewardAmount = _randomReward(
          rewardRand,
          caseType.priceUSDC,
          caseType.maxRewardUsd,
          opening.btcUsdPrice
        );
      } else {
        rewardAmount = _randomReward(
          rewardRand,
          caseType.minRewardUsd,
          caseType.priceUSDC,
          opening.btcUsdPrice
        );
      }
    } else {
      rewardAmount = _randomReward(
        randomBase,
        caseType.minRewardUsd,
        caseType.maxRewardUsd,
        opening.btcUsdPrice
      );
    }

    if (opening.reservedAmount > 0) {
      reservedCbBtcReward = reservedCbBtcReward - opening.reservedAmount + rewardAmount;
      opening.reservedAmount = rewardAmount;
    }
    opening.rewardAmount = rewardAmount;
    opening.rewarded = true;

    emit CaseRewarded(openingId, rewardAmount);
  }

  function _randomReward(
    uint256 randomBase,
    uint256 minRewardUsd,
    uint256 maxRewardUsd,
    uint256 btcUsdPrice
  ) internal view returns (uint256) {
    if (maxRewardUsd <= minRewardUsd) {
      return _usdToCbBtc(minRewardUsd, btcUsdPrice);
    }
    uint256 minRewardCbBtc = _usdToCbBtc(minRewardUsd, btcUsdPrice);
    uint256 maxRewardCbBtc = _usdToCbBtc(maxRewardUsd, btcUsdPrice);
    if (maxRewardCbBtc <= minRewardCbBtc) {
      return minRewardCbBtc;
    }
    uint256 rewardRange = maxRewardCbBtc - minRewardCbBtc + 1;
    return minRewardCbBtc + (randomBase % rewardRange);
  }

  function _randomRange(uint256 randomBase, uint256 minValue, uint256 maxValue) internal pure returns (uint256) {
    if (maxValue <= minValue) {
      return minValue;
    }
    uint256 range = maxValue - minValue + 1;
    return minValue + (randomBase % range);
  }
}
