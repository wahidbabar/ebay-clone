import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

import {
  useContract,
  useListing,
  MediaRenderer,
  useNetwork,
  useNetworkMismatch,
  useMakeBid,
  useMakeOffer,
  useOffers,
  useBuyNow,
  useAddress,
  useAcceptDirectListingOffer,
} from "@thirdweb-dev/react";
import Header from "../../components/Header/Header";
import { UserCircleIcon } from "@heroicons/react/24/solid";
import { ListingType, NATIVE_TOKENS } from "@thirdweb-dev/sdk";
import Countdown from "react-countdown";
import network from "../../utils/network";
import { ethers } from "ethers";

function ListingPage() {
  const address = useAddress();
  const router = useRouter();
  const { listingId } = router.query as { listingId: string };
  const [minimumNextBid, setMinimumNextBid] = useState<{
    displayValue: string;
    symbol: string;
  }>();
  const [bidOrOfferAmount, setBidAmount] = useState("");
  const isMismatched = useNetworkMismatch();
  const [, switchNetwork] = useNetwork();

  const { contract } = useContract(
    process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT,
    "marketplace"
  );

  const { data: listing, isLoading, error } = useListing(contract, listingId);

  const { mutate: makeBid } = useMakeBid(contract);

  const { mutate: buyNow } = useBuyNow(contract);

  const { mutate: makeOffer } = useMakeOffer(contract);

  const { data: offers } = useOffers(contract, listingId);

  const { mutate: acceptOffer } = useAcceptDirectListingOffer(contract);

  useEffect(() => {
    if (!listingId || !contract || !listing) return;

    if (listing.type === ListingType.Auction) {
      fetchNextMinimumBid();
    }
  }, [listingId, listing, contract]);

  const fetchNextMinimumBid = async () => {
    if (!listing || !contract) return;

    const minBidResponse = await contract.auction.getMinimumNextBid(listingId);
    const { displayValue, symbol } = minBidResponse;

    setMinimumNextBid({
      displayValue,
      symbol,
    });
  };

  const formatPlaceHolder = () => {
    if (!listing) return;

    if (listing.type === ListingType.Direct) {
      return "Enter Offer Amount";
    }

    if (listing.type === ListingType.Auction) {
      return Number(minimumNextBid?.displayValue) === 0
        ? "Enter Bid Amount"
        : `${minimumNextBid?.displayValue} ${minimumNextBid?.symbol} or more`;
    }
  };

  const buyNFT = async () => {
    if (isMismatched) {
      switchNetwork && switchNetwork(network);
      return;
    }

    if (!listing || !listingId || !contract) {
      return;
    }

    await buyNow(
      {
        id: listingId,
        type: listing.type,
        buyAmount: 1,
      },
      {
        onSuccess(data, variables, context) {
          alert("NFT bought successfully!");
          console.log("SUCCESS", data, variables, context);
          router.replace("/");
        },
        onError(error, variables, context) {
          alert("ERROR: NFT could not be bought!");
          console.log("ERROR", error);
        },
      }
    );
  };

  const createBidOrOfferHandler = async () => {
    if (isMismatched) {
      switchNetwork && switchNetwork(network);
      return;
    }

    // Direct Listing

    if (listing?.type === ListingType.Direct) {
      if (
        listing.buyoutPrice.toString() ===
        ethers.utils.parseEther(bidOrOfferAmount).toString()
      ) {
        console.log("Buyout Price met, buying NFT...");

        buyNFT();
        return;
      }

      await makeOffer(
        {
          listingId,
          pricePerToken: bidOrOfferAmount,
          quantity: 1,
        },
        {
          onSuccess(data, variables, context) {
            alert("Offer made successfully!");
            console.log("SUCCESS", data, variables, context);
            setBidAmount("");
          },
          onError(error, variables, context) {
            alert("Offer could not be made!");
            console.log("ERROR", error);
          },
        }
      );
    }

    // Auction Listing

    if (listing?.type === ListingType.Auction) {
      console.log("making bid");

      makeBid(
        {
          bid: bidOrOfferAmount,
          listingId,
        },
        {
          onSuccess(data, variables, context) {
            alert("Bid made successfully!");
            console.log("SUCCESS", data, variables, context);
            setBidAmount("");
          },
          onError(error, variables, context) {
            alert("ERROR: bid could not be made!");
            console.log("ERROR", error);
          },
        }
      );
    }
  };

  const acceptOfferHandler = async (offer: Record<string, any>) => {
    acceptOffer(
      {
        listingId,
        addressOfOfferor: offer.offeror,
      },
      {
        onSuccess(data, variables, context) {
          alert("Offer accepted successfully!");
          console.log("SUCCESS", data, variables, context);
          router.replace("/");
        },
        onError(error, variables, context) {
          alert("ERROR: Offer could not be accepted!");
          console.log("ERROR", error, variables, context);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div>
        <Header />
        <div className="text-center animate-pulse text-blue-500">
          <p>Loading Item...</p>
        </div>
      </div>
    );
  }

  if (!listing) {
    return <div>Listing not found</div>;
  }

  return (
    <div>
      <Header />

      <main className="max-w-6xl mx-auto p-2 flex flex-col lg:flex-row space-y-10 space-x-5">
        <div className="p-10 border mx-auto lg:mx-0 mx-w-md lg:max-w-xl">
          <MediaRenderer src={listing?.asset.image} />
        </div>

        <section className="flex-1 space-y-5 pb-20 lg:pb-0">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold">{listing.asset.name}</h1>
            <p className="text-gray-600">{listing.asset.description}</p>
            <p className="flex items-center text-xs sm:text-base">
              <UserCircleIcon className="h-5" />
              <span className="font-bold pr-1">Seller: </span>
              {listing.sellerAddress}
            </p>
          </div>

          <div className="grid grid-cols-2 items-center py-2">
            <p className="font-bold">Listing Type: </p>
            <p>
              {listing.type === ListingType.Direct
                ? "Direct Listing"
                : "Auction Listing"}
            </p>

            <p className="font-bold">Buy it Now Price: </p>
            <p className="text-4xl font-bold">
              {listing.buyoutCurrencyValuePerToken.displayValue}{" "}
              {listing.buyoutCurrencyValuePerToken.symbol}
            </p>

            <button
              onClick={buyNFT}
              className="col-start-2 mt-2 bg-blue-600 font-bold text-white py-4 rounded-full px-10 w-44"
            >
              Buy Now
            </button>
          </div>

          {/* if Direct, show offers here  */}

          {listing.type === ListingType.Direct && offers && (
            <div className="grid grid-cols-2 gap-y-2">
              <p className="font-bold">Offers: </p>
              <p className="font-bold">
                {offers.length > 0 ? offers.length : 0}
              </p>

              {offers.map((offer) => (
                <>
                  <p className="flex items-center ml-5 text-sm italic">
                    <UserCircleIcon />
                    {offer.offeror.slice(0, 5) +
                      "..." +
                      offer.offeror.slice(-5)}
                  </p>
                  <div>
                    <p
                      className="text-sm italic"
                      key={
                        offer.listingId +
                        offer.offeror +
                        offer.totalOfferAmount.toString()
                      }
                    >
                      {ethers.utils.formatEther(offer.totalOfferAmount)}{" "}
                      {NATIVE_TOKENS[network].symbol}
                    </p>

                    {listing.sellerAddress === address && (
                      <button
                        onClick={() => acceptOfferHandler(offer)}
                        className="p-2 2-32 bg-red-500/50 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Accept Offer
                      </button>
                    )}
                  </div>
                </>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 space-y-2 items-center justify-end">
            <hr className="col-span-2" />
            <p className="col-span-2 font-bold">
              {listing.type === ListingType.Direct
                ? "Make an Offer"
                : "Bid on this Auction"}
            </p>

            {/* Remaining time on auction goes here */}
            {listing.type === ListingType.Auction && (
              <>
                <p>Current Minimum Bid:</p>
                <p className="font-bold">
                  {Number(minimumNextBid?.displayValue) === 0
                    ? "No minimum bid"
                    : `${minimumNextBid?.displayValue} ${minimumNextBid?.symbol} or more`}
                </p>

                <p>Time Remaining</p>
                <Countdown
                  date={Number(listing.endTimeInEpochSeconds.toString()) * 1000}
                />
              </>
            )}

            <input
              className="border p-2 rouned-lg mr-5 outline-red-500"
              type="text"
              placeholder={formatPlaceHolder()}
              onChange={(e) => setBidAmount(e.target.value)}
            />
            <button
              onClick={createBidOrOfferHandler}
              className="col-start-2 font-bold text-white bg-red-600 py-4 px-10 rounded-full w-44"
            >
              {listing.type === ListingType.Direct ? "Offer" : "Bid"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ListingPage;
