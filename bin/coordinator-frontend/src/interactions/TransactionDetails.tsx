const TransactionDetails = () => {
  return (
    <>
      <div className="flex w-[588px] flex-col border-[0.5px] border-[#00000033]   h-fit bg-[#FAFAFA] shadow-2xl  relative">
        <div className="flex w-[588px] flex-col border-[0.5px] border-[#00000033]">
          <div className="p-4 text-center text-[24px] font-[300] uppercase">
            transaction details
          </div>
          <div className="h-[0.5px] bg-[#00000033]"></div>

          <div className="flex flex-col space-y-2 p-6">
            <span className="font-dmmono text-[14px] text-[#FF5500] uppercase">
              transaction overview
            </span>

            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                action type
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
                send
              </span>
            </div>

            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                amount
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
                -150 miden
              </span>
            </div>
            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                recipient
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
                mts123..rfgr
              </span>
            </div>

            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                status
              </span>
              <span className="font-dmmono text-[12px] text-[#FF5500] font-[500] uppercase">
                executed
              </span>
            </div>

            <div className="h-[0.5px] w-full bg-[#00000033]"></div>

            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                time
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
                2 hours ago
              </span>
            </div>
          </div>

          <div className="h-[0.5px] bg-[#00000033]"></div>

          <div className="flex flex-col space-y-2 p-6">
            <span className="font-dmmono text-[14px] text-[#FF5500] uppercase">
            Network information
            </span>

            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
              network
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
                miden testnet
              </span>
            </div>

            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
               transaction hash
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
              mts1234..fgr
              </span>
            </div>
            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                gas fee
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
              0.001 miden
              </span>
            </div>
          </div>

          <div className="h-[0.5px] bg-[#00000033]"></div>

          <div className="flex flex-col space-y-2 p-6">
            <span className="font-dmmono text-[14px] text-[#FF5500] uppercase">
            additional details
            </span>

            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
                TRANSACTION ID
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
                TX_2_PENDING
              </span>
            </div>

            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
              note id
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
              note-1-sent
              </span>
            </div>
            <div className="h-[0.5px] w-full bg-[#00000033]"></div>
            <div className="flex flex-row justify-between">
              <span className="font-dmmono text-[12px] font-[400] text-[#00000099] uppercase">
              wallet
              </span>
              <span className="font-dmmono text-[12px] font-[500] uppercase">
              main wallet
              </span>
            </div>
          </div>

          <div
            className="font-dmmono mx-auto w-[90%] border-[0.5px] p-2 mb-6 border-[#00000033] bg-[#F8F9FC] text-center text-[16px] font-[300]"
            // onClick={onClose}
          >
            CLOSE
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionDetails;
