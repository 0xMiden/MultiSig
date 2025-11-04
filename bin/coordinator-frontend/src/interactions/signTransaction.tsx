"use client"
import { addSignatureThunk, fetchPendingTransactions, fetchConfirmedTransactions } from "@/services";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const SignTransaction = ({ transactionId, onCancel }: { transactionId: string, onCancel?: () => void }) => {
  const dispatch = useAppDispatch();
  
  // Add missing state variables
  const [formData, setFormData] = useState({
    approverAddress: '',
    signature: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (!formData.approverAddress.trim()) {
      setError('Approver address is required');
      return;
    }
    
    if (!formData.signature.trim()) {
      setError('Signature is required');
      return;
    }
    
    if (!transactionId) {
      setError('No transaction ID found. Please initiate a transaction first.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Prepare the signature data according to the API payload structure
      const signatureData = {
        approver_address: formData.approverAddress,
        signature: formData.signature
      };
      
      
      // Call the addSignatureThunk
      const result = await dispatch(addSignatureThunk({
        txId: transactionId,
        signatureData
      })).unwrap();
      
      
      setSuccess('Signature added successfully!');
      
      try {
        const walletId = localStorage.getItem('currentWalletId');
        if (walletId) {
          await Promise.all([
            dispatch(fetchPendingTransactions({ accountId: walletId })),
            dispatch(fetchConfirmedTransactions({ accountId: walletId }))
          ]);
        }
      } catch (refreshError) {
        console.warn('Failed to refresh transaction data:', refreshError);
      }
      
      // Add a small delay to show success state
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Close modal on success
      if (onCancel) {
        onCancel();
      }
    } catch (err) {
      console.error('Error signing transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
  <>
  
  <div
      style={{ backgroundColor: "white" }}
      className=" max-w-[90vw]  h-[607px] max-h-[90vh] rounded-2xl bg-[#FAFAFA] shadow-2xl border border-neutral-200 opacity-100"
    >
      <div
        style={{ paddingTop: "20px" }}
        className="uppercase text-[24px] font-dmmono font-[500] text-[#000000] px-6  py-4 "
      >
        Approve Transaction
      </div>
      <div
        style={{ height: "1px", backgroundColor: "#00000033" }}
        className="w-full"
      ></div>
      <div className="flex flex-col space-y-4 px-6 py-4">
        {/* Transaction ID Display */}
        <div className="w-full border-[1.09px] border-gray-300 text-[12px] font-dmmono font-[400] bg-gray-50 p-2 text-gray-700">
          Transaction ID: {transactionId }
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="w-full border-[1.09px] border-red-500 text-[12px] font-dmmono font-[400] bg-red-50 p-2 text-red-600">
            Error: {error}
          </div>
        )}
        
        {/* Success Display */}
        {success && (
          <div className="w-full border-[1.09px] border-green-500 text-[12px] font-dmmono font-[400] bg-green-50 p-2 text-green-600">
            {success}
          </div>
        )}
        
        <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
          <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
            Approver Address
          </div>
          <input
            type="text"
            value={formData.approverAddress}
            onChange={(e) => handleInputChange('approverAddress', e.target.value)}
            placeholder="Enter approver address"
            className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
          />
        </div>
        
        <div className="w-full flex flex-col lg:space-y-2 md:space-y-1.5 sm:space-y-1 space-y-0.5 ">
          <div className="uppercase lg:text-[14px] md:text-[14px] sm:text-[13px] text-[12px] font-dmmono">
            Signature
          </div>
          <input
            type="text"
            value={formData.signature}
            onChange={(e) => handleInputChange('signature', e.target.value)}
            placeholder="Enter signature (0x...)"
            className="bg-[#FFFFFF] w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] border-[1.09px] border-[rgba(217,217,217,1)] px-3 font-dmmono font-[500] text-[12px] focus:outline-none focus:ring-2 focus:ring-[#FF5500]/60"
          />
        </div>
        
        <div>
          {/* button section starts here  */}
          <div className="w-full lg:h-[40px] md:h-[40px] sm:h-[36px] h-[32px] flex flex-row gap-2">
            <button
              onClick={handleCancel}
              disabled={isSubmitting}
              className="  flex-1 px-4 bg-[rgba(249,249,249,1)] border-[0.5px] border-[#00000033] uppercase h-full font-dmmono font-[400] lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isSubmitting || !transactionId}
              className={`relative group overflow-hidden flex-1 px-2 uppercase h-full font-[500] font-dmmono lg:text-[14px] md:text-[14px] sm:text-[12px] text-[11px] ${
                isSubmitting || !transactionId 
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                  : 'bg-[rgba(255,85,0,1)] text-[rgba(255,255,255,1)]'
              }`}
            >
              <span className={`absolute inset-0 transform scale-x-0 origin-left transition-transform duration-300 ease-out ${
                isSubmitting || !transactionId ? 'bg-gray-500' : 'bg-[#E64A00] group-hover:scale-x-100'
              }`}></span>
              <span className="relative z-10">
                {isSubmitting ? 'APPROVING...' : 'APPROVE'}
              </span>
            </button>
          </div>
          {/* button section ends here  */}
        </div>
      </div>
    </div>
  </>
  );
};

export default SignTransaction;
