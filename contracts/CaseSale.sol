// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { AggregatorV3Interface } from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import { VRFConsumerBaseV2Plus } from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import { IVRFCoordinatorV2Plus } from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import { VRFV2PlusClient } from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract CaseSale is VRFConsumerBaseV2Plus, ReentrancyGuard {
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
    uint256 rewardAmount;
    uint256 reservedAmount;
    uint256 btcUsdPrice;
    bool rewarded;
    bool claimed;
    uint256 requestId;
  }

  IERC20 public immutable usdc;
  IERC20 public immutable cbBtc;
  AggregatorV3Interface public immutable btcUsdFeed;
  uint8 public immutable btcUsdDecimals;
  uint256 public immutable btcUsdScale;
  address public treasury;

  IVRFCoordinatorV2Plus public immutable vrfCoordinator;
  bytes32 public keyHash;
  uint256 public subscriptionId;
  uint16 public requestConfirmations;
  uint32 public callbackGasLimit;

  uint256 public nextOpeningId;
  uint256 public reservedReward;
  uint256 public maxPriceAge;

  mapping(uint256 => CaseType) public caseTypes;
  mapping(uint256 => Opening) public openings;
  mapping(uint256 => uint256) public requestToOpeningId;

  event CaseTypeUpdated(
    uint256 indexed caseTypeId,
    uint256 priceUSDC,
    uint256 minRewardUsd,
    uint256 maxRewardUsd,
    uint16 positiveReturnBps,
    bool enabled
  );
  event CasePurchased(address indexed buyer, uint256 indexed caseTypeId, uint256 indexed openingId, uint256 priceUSDC);
  event CaseRandomnessRequested(uint256 indexed openingId, uint256 indexed requestId);
  event CaseRewarded(uint256 indexed openingId, uint256 rewardAmount);
  event CaseClaimed(uint256 indexed openingId, address indexed buyer, uint256 rewardAmount);
  event TreasuryUpdated(address indexed treasury);
  event VrfConfigUpdated(bytes32 keyHash, uint256 subscriptionId, uint16 requestConfirmations, uint32 callbackGasLimit);
  event MaxPriceAgeUpdated(uint256 maxPriceAge);

  constructor(
    address usdcAddress,
    address cbBtcAddress,
    address btcUsdFeedAddress,
    address treasuryAddress,
    address vrfCoordinatorAddress,
    bytes32 vrfKeyHash,
    uint256 vrfSubscriptionId,
    uint16 vrfRequestConfirmations,
    uint32 vrfCallbackGasLimit
  ) VRFConsumerBaseV2Plus(vrfCoordinatorAddress) {
    require(usdcAddress != address(0), "USDC address required");
    require(cbBtcAddress != address(0), "cbBTC address required");
    require(btcUsdFeedAddress != address(0), "BTC/USD feed required");
    require(treasuryAddress != address(0), "Treasury address required");

    usdc = IERC20(usdcAddress);
    cbBtc = IERC20(cbBtcAddress);
    btcUsdFeed = AggregatorV3Interface(btcUsdFeedAddress);
    btcUsdDecimals = btcUsdFeed.decimals();
    btcUsdScale = 10 ** btcUsdDecimals;
    treasury = treasuryAddress;
    vrfCoordinator = IVRFCoordinatorV2Plus(vrfCoordinatorAddress);

    keyHash = vrfKeyHash;
    subscriptionId = vrfSubscriptionId;
    requestConfirmations = vrfRequestConfirmations;
    callbackGasLimit = vrfCallbackGasLimit;
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

  function setVrfConfig(
    bytes32 vrfKeyHash,
    uint256 vrfSubscriptionId,
    uint16 vrfRequestConfirmations,
    uint32 vrfCallbackGasLimit
  ) external onlyOwner {
    keyHash = vrfKeyHash;
    subscriptionId = vrfSubscriptionId;
    requestConfirmations = vrfRequestConfirmations;
    callbackGasLimit = vrfCallbackGasLimit;
    emit VrfConfigUpdated(vrfKeyHash, vrfSubscriptionId, vrfRequestConfirmations, vrfCallbackGasLimit);
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
    require(priceUSDC >= minRewardUsd && priceUSDC <= maxRewardUsd, "Price outside range");
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
    if (!caseType.enabled || caseType.maxRewardUsd == 0) {
      return 0;
    }
    uint256 price = _getBtcUsdPrice();
    uint256 maxReward = _usdToCbBtc(caseType.maxRewardUsd, price);
    if (maxReward == 0) {
      return 0;
    }
    uint256 balance = cbBtc.balanceOf(address(this));
    if (balance <= reservedReward) {
      return 0;
    }
    return (balance - reservedReward) / maxReward;
  }

  function purchaseCase(uint256 caseTypeId) external nonReentrant returns (uint256 openingId) {
    CaseType memory caseType = caseTypes[caseTypeId];
    require(caseType.enabled, "Case disabled");
    require(caseType.priceUSDC > 0, "Case not found");

    uint256 btcUsdPrice = _getBtcUsdPrice();
    uint256 maxReward = _usdToCbBtc(caseType.maxRewardUsd, btcUsdPrice);
    require(maxReward > 0, "Price too low");

    uint256 balance = cbBtc.balanceOf(address(this));
    require(balance > reservedReward, "Sold out");
    require((balance - reservedReward) / maxReward > 0, "Sold out");

    usdc.safeTransferFrom(msg.sender, treasury, caseType.priceUSDC);

    openingId = ++nextOpeningId;
    reservedReward += maxReward;
    openings[openingId] = Opening({
      buyer: msg.sender,
      caseTypeId: caseTypeId,
      rewardAmount: 0,
      reservedAmount: maxReward,
      btcUsdPrice: btcUsdPrice,
      rewarded: false,
      claimed: false,
      requestId: 0
    });

    uint256 requestId = vrfCoordinator.requestRandomWords(
      VRFV2PlusClient.RandomWordsRequest({
        keyHash: keyHash,
        subId: subscriptionId,
        requestConfirmations: requestConfirmations,
        callbackGasLimit: callbackGasLimit,
        numWords: 1,
        extraArgs: VRFV2PlusClient._argsToBytes(
          VRFV2PlusClient.ExtraArgsV1({nativePayment: true})
        )
      })
    );

    openings[openingId].requestId = requestId;
    requestToOpeningId[requestId] = openingId;

    emit CasePurchased(msg.sender, caseTypeId, openingId, caseType.priceUSDC);
    emit CaseRandomnessRequested(openingId, requestId);
  }

  function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
    uint256 openingId = requestToOpeningId[requestId];
    Opening storage opening = openings[openingId];
    require(opening.buyer != address(0), "Opening not found");
    require(!opening.rewarded, "Already rewarded");

    CaseType memory caseType = caseTypes[opening.caseTypeId];
    uint256 randomBase = randomWords[0];
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
      reservedReward = reservedReward - opening.reservedAmount + rewardAmount;
      opening.reservedAmount = rewardAmount;
    }
    opening.rewardAmount = rewardAmount;
    opening.rewarded = true;

    emit CaseRewarded(openingId, rewardAmount);
  }

  function claimReward(uint256 openingId) external nonReentrant {
    Opening storage opening = openings[openingId];
    require(opening.buyer == msg.sender, "Not opener");
    require(opening.rewarded, "Reward not ready");
    require(!opening.claimed, "Already claimed");

    opening.claimed = true;
    if (opening.reservedAmount > 0) {
      reservedReward -= opening.reservedAmount;
      opening.reservedAmount = 0;
    }
    cbBtc.safeTransfer(msg.sender, opening.rewardAmount);

    emit CaseClaimed(openingId, msg.sender, opening.rewardAmount);
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
}
