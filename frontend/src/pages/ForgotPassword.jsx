import axios from 'axios';
import React, { useState } from 'react'
import { IoIosArrowRoundBack } from "react-icons/io";
import { useNavigate } from 'react-router-dom';
import { apiBase as serverUrl } from '../api';
import { ClipLoader } from 'react-spinners';
import { notify, errMsg } from '../toast';
function ForgotPassword() {
  const [step, setStep] = useState(1)
  const [email,setEmail]=useState("")
  const [otp,setOtp]=useState("")
  const [newPassword,setNewPassword]=useState("")
  const [confirmPassword,setConfirmPassword]=useState("")
  const [err,setErr]=useState("")
  const navigate=useNavigate()
const [loading,setLoading]=useState(false)
  const handleSendOtp=async () => {
    setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/auth/send-otp`,{email},{withCredentials:true})
      setErr("")
      setStep(2)
      setLoading(false)
    } catch (error) {
       setErr(errMsg(error,"Could not send the OTP. Please try again."))
       setLoading(false)
    }
  }
  const handleVerifyOtp=async () => {
      setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/auth/verify-otp`,{email,otp},{withCredentials:true})
      setErr("")
      setStep(3)
        setLoading(false)
    } catch (error) {
        setErr(errMsg(error,"Could not verify the OTP. Please try again."))
          setLoading(false)
    }
  }
  const handleResetPassword=async () => {
    if(newPassword.length < 6){
      return setErr("Password must be at least 6 characters")
    }
    if(newPassword!==confirmPassword){
      return setErr("Passwords do not match")
    }
    setLoading(true)
    try {
      await axios.post(`${serverUrl}/api/auth/reset-password`,{email,newPassword},{withCredentials:true})
      setErr("")
        setLoading(false)
      notify.success("Password reset. Please sign in.")
      navigate("/signin")
    } catch (error) {
     setErr(errMsg(error,"Could not reset the password. Please try again."))
       setLoading(false)
    }
  }
  return (
    <div className='flex w-full items-center justify-center min-h-screen p-4 bg-[#fff9f6]'>
      <div className='bg-white rounded-xl shadow-lg w-full max-w-md p-8'>
        <div className='flex items-center  gap-4 mb-4'>
          <button type="button" aria-label="Back to sign in" onClick={()=>navigate("/signin")}><IoIosArrowRoundBack size={30} className='text-[#ff4d2d] cursor-pointer'/></button>
          <h1 className='text-2xl font-bold text-center text-[#ff4d2d]'>Forgot Password</h1>
        </div>
        {step == 1
          &&
          <div>
 <div className='mb-6'>
                    <label htmlFor="email" className='block text-gray-700 font-medium mb-1'>Email</label>
                    <input id="email" type="email" autoComplete="email" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Enter your Email' onChange={(e)=>setEmail(e.target.value)} value={email} required/>
                </div>
                <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`} onClick={handleSendOtp} disabled={loading}>
                {loading?<ClipLoader size={20} color='white'/>:"Send Otp"}
            </button>
                 {err && <p className='text-red-500 text-center my-[10px]'>*{err}</p>}
          </div>}

         {step == 2
          &&
          <div>
 <div className='mb-6'>
                    <label htmlFor="otp" className='block text-gray-700 font-medium mb-1'>OTP</label>
                    <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Enter OTP' onChange={(e)=>setOtp(e.target.value)} value={otp} required/>
                </div>
                <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`} onClick={handleVerifyOtp} disabled={loading}>
                {loading?<ClipLoader size={20} color='white'/>:"Verify"}
            </button>
                {err && <p className='text-red-500 text-center my-[10px]'>*{err}</p>}
          </div>}
          {step == 3
          &&
          <div>
 <div className='mb-6'>
                    <label htmlFor="newPassword" className='block text-gray-700 font-medium mb-1'>New Password</label>
                    <input id="newPassword" type="password" autoComplete="new-password" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Enter New Password' onChange={(e)=>setNewPassword(e.target.value)} value={newPassword}/>
                </div>
                <div className='mb-6'>
                    <label htmlFor="confirmPassword" className='block text-gray-700 font-medium mb-1'>Confirm Password</label>
                    <input id="confirmPassword" type="password" autoComplete="new-password" className='w-full border-[1px] border-gray-200 rounded-lg px-3 py-2 focus:outline-none  ' placeholder='Confirm Password' onChange={(e)=>setConfirmPassword(e.target.value)} value={confirmPassword} required/>
                </div>
                <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`} onClick={handleResetPassword} disabled={loading}>
                {loading?<ClipLoader size={20} color='white'/>:"Reset Password"}
            </button>
                {err && <p className='text-red-500 text-center my-[10px]'>*{err}</p>}
          </div>}
      </div>
    </div>
  )
}

export default ForgotPassword
