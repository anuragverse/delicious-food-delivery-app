import React from 'react'
import { useState } from 'react';
import { FaRegEye } from "react-icons/fa";
import { FaRegEyeSlash } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { useNavigate } from 'react-router-dom';
import axios from "axios"
import { apiBase as serverUrl } from '../api';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../../firebase';
import { ClipLoader } from 'react-spinners';
import { useDispatch } from 'react-redux';
import { setUserData } from '../redux/userSlice';
import { errMsg } from '../toast';
function SignIn() {
    const primaryColor = "#ff4d2d";
    const bgColor = "#fff9f6";
    const borderColor = "#ddd";
    const [showPassword, setShowPassword] = useState(false)
    const navigate=useNavigate()
    const [email,setEmail]=useState("")
    const [password,setPassword]=useState("")
    const [err,setErr]=useState("")
    const [loading,setLoading]=useState(false)
    const [googleLoading,setGoogleLoading]=useState(false)
    const dispatch=useDispatch()
     const handleSignIn=async () => {
        if(!email.trim() || !password){
            return setErr("Please enter your email and password")
        }
        setLoading(true)
        try {
            const result=await axios.post(`${serverUrl}/api/auth/signin`,{
                email,password
            },{withCredentials:true})
           dispatch(setUserData(result.data))
            setErr("")
            setLoading(false)
        } catch (error) {
           setErr(errMsg(error,"Sign in failed. Please try again."))
           setLoading(false)
        }
     }
     const handleGoogleAuth=async () => {
       setGoogleLoading(true)
       if(!auth){
         setGoogleLoading(false)
         return setErr("Google sign-in is not available right now. Please use email and password.")
       }
       try {
         const provider=new GoogleAuthProvider()
         const result=await signInWithPopup(auth,provider)
         // The server verifies this Firebase token with Google; the email alone is never trusted
         const idToken=await result.user.getIdToken()
         const {data}=await axios.post(`${serverUrl}/api/auth/google-auth`,{
             idToken,
         },{withCredentials:true})
         dispatch(setUserData(data))
         setErr("")
       } catch (error) {
         setErr(errMsg(error,"Google sign-in failed. Please try again."))
       } finally {
         setGoogleLoading(false)
       }
          }
    return (
        <div className='min-h-screen w-full flex items-center justify-center p-4' style={{ backgroundColor: bgColor }}>
            <div className={`bg-white rounded-xl shadow-lg w-full max-w-md p-8 border-[1px] `} style={{
                border: `1px solid ${borderColor}`
            }}>
                <h1 className={`text-3xl font-bold mb-2 `} style={{ color: primaryColor }}>Delicious</h1>
                <p className='text-gray-600 mb-8'> Sign In to your account to get started with delicious food deliveries
                </p>

              
                <form onSubmit={(e)=>{e.preventDefault();handleSignIn()}} noValidate>
                {/* email */}

                <div className='mb-4'>
                    <label htmlFor="email" className='block text-gray-700 font-medium mb-1'>Email</label>
                    <input id="email" type="email" autoComplete="email" className='w-full border rounded-lg px-3 py-2 focus:outline-none ' placeholder='Enter your Email' style={{ border: `1px solid ${borderColor}` }} onChange={(e)=>setEmail(e.target.value)} value={email} required/>
                </div>
                {/* password*/}

                <div className='mb-4'>
                    <label htmlFor="password" className='block text-gray-700 font-medium mb-1'>Password</label>
                    <div className='relative'>
                        <input id="password" autoComplete="current-password" type={`${showPassword ? "text" : "password"}`} className='w-full border rounded-lg px-3 py-2 focus:outline-none pr-10' placeholder='Enter your password' style={{ border: `1px solid ${borderColor}` }} onChange={(e)=>setPassword(e.target.value)} value={password} required/>

                        <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} className='absolute right-3 cursor-pointer top-[14px] text-gray-500' onClick={() => setShowPassword(prev => !prev)}>{!showPassword ? <FaRegEye /> : <FaRegEyeSlash />}</button>
                    </div>
                </div>
                <div className='text-right mb-4'>
                  <button type="button" className='cursor-pointer text-[#ff4d2d] font-medium hover:underline' onClick={()=>navigate("/forgot-password")}>
                    Forgot Password
                  </button>
                </div>
              

            <button className={`w-full font-semibold py-2 rounded-lg transition duration-200 bg-[#ff4d2d] text-white hover:bg-[#e64323] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`} type="submit" disabled={loading}>
                {loading?<ClipLoader size={20} color='white'/>:"Sign In"}
            </button>
      {err && <p className='text-red-500 text-center my-[10px]' role="alert">{err}</p>}
            </form>

            <button type="button" disabled={googleLoading} className='w-full mt-4 flex items-center justify-center gap-2 border rounded-lg px-4 py-2 transition cursor-pointer duration-200 border-gray-400 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed' onClick={handleGoogleAuth}>
<FcGoogle size={20}/>
<span>{googleLoading ? "Signing in..." : "Sign In with Google"}</span>
            </button>
            <p className='text-center mt-6'>Want to create a new account ? <button type="button" className='text-[#ff4d2d] font-medium cursor-pointer hover:underline' onClick={()=>navigate("/signup")}>Sign Up</button></p>
            </div>
        </div>
    )
}

export default SignIn
