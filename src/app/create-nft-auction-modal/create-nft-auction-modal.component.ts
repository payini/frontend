import { Component, OnInit, Input } from "@angular/core";
import { BsModalRef, BsModalService } from "ngx-bootstrap/modal";
import { GlobalVarsService } from "../global-vars.service";
import { AuctionCreatedModalComponent } from "../auction-created-modal/auction-created-modal.component";
import { BackendApiService, NFTEntryResponse, PostEntryResponse } from "../backend-api.service";
import { concatMap, filter, last, map, take } from "rxjs/operators";
import { of } from "rxjs";

@Component({
  selector: "create-nft-auction",
  templateUrl: "./create-nft-auction-modal.component.html",
})
export class CreateNftAuctionModalComponent implements OnInit {
  @Input() postHashHex: string;
  @Input() post: PostEntryResponse;
  @Input() nftEntryResponses: NFTEntryResponse[];
  loading = false;
  minBidAmountUSD: string;
  minBidAmountCLOUT: number;
  selectedSerialNumbers: boolean[] = [];
  selectAll: boolean = false;
  creatingAuction: boolean = false;

  constructor(
    private backendApi: BackendApiService,
    public globalVars: GlobalVarsService,
    private modalService: BsModalService,
    public bsModalRef: BsModalRef
  ) {}

  ngOnInit(): void {}

  updateMinBidAmountUSD(cloutAmount) {
    this.minBidAmountUSD = this.globalVars.nanosToUSDNumber(cloutAmount * 1e9).toFixed(2);
  }

  updateMinBidAmountCLOUT(usdAmount) {
    this.minBidAmountCLOUT = Math.trunc(this.globalVars.usdToNanosNumber(usdAmount)) / 1e9;
  }

  auctionTotal: number;
  auctionCounter: number = 0;
  createAuction() {
    this.auctionTotal = this.selectedSerialNumbers.filter((res) => res).length;
    this.creatingAuction = true;
    of(...this.selectedSerialNumbers.map((isSelected, index) => (isSelected ? index : -1)))
      .pipe(
        concatMap((val) => {
          if (val >= 0) {
            return this.backendApi
              .UpdateNFT(
                this.globalVars.localNode,
                this.globalVars.loggedInUser.PublicKeyBase58Check,
                this.post.PostHashHex,
                val,
                true,
                Math.trunc(this.minBidAmountCLOUT * 1e9),
                this.globalVars.defaultFeeRateNanosPerKB
              )
              .pipe(
                map((res) => {
                  this.auctionCounter++;
                  return res;
                })
              );
          } else {
            return of("");
          }
        })
      )
      .pipe(last((res) => res))
      .subscribe(
        (res) => {
          // Hide this modal and open the next one.
          this.bsModalRef.hide();
          const modalRef = this.modalService.show(AuctionCreatedModalComponent, {
            class: "modal-dialog-centered modal-sm",
          });
          modalRef.onHide
            .pipe(
              take(1),
              filter((reason) => {
                return reason !== "explore";
              })
            )
            .subscribe(() => {
              window.location.reload();
            });
        },
        (err) => {
          console.error(err);
          this.globalVars._alertError(this.backendApi.parseMessageError(err));
        }
      )
      .add(() => (this.creatingAuction = false));
  }

  mySerialNumbersNotForSale(): NFTEntryResponse[] {
    return this.nftEntryResponses.filter(
      (nftEntryResponse) =>
        !nftEntryResponse.IsForSale &&
        nftEntryResponse.OwnerPublicKeyBase58Check === this.globalVars.loggedInUser?.PublicKeyBase58Check
    );
  }

  toggleSelectAll(val: boolean) {
    this.mySerialNumbersNotForSale().forEach(
      (nftEntryResponse) => (this.selectedSerialNumbers[nftEntryResponse.SerialNumber] = val)
    );
  }

  createAuctionDisabled(): boolean {
    return !this.selectedSerialNumbers.filter((isSelected) => isSelected)?.length;
  }

  selectSerialNumber(idx: number): void {
    this.selectAll = false;
    for (let ii = 0; ii < this.selectedSerialNumbers.length; ii++) {
      this.selectedSerialNumbers[ii] = ii === idx;
    }
  }
}