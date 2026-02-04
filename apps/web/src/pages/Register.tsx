import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { TrendingUp, Phone, User, Upload } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/auth';

const step1Schema = z.object({
  phoneNumber: z.string().min(10, 'Enter a valid phone number'),
});

const step2Schema = z.object({
  code: z.string().length(6, 'OTP must be 6 digits'),
});

const step3Schema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
});

type Step = 'phone' | 'otp' | 'profile';

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  // Check if coming from login with verified phone
  const state = location.state as { phoneNumber?: string; verificationToken?: string } | null;

  const [step, setStep] = useState<Step>(state?.phoneNumber ? 'profile' : 'phone');
  const [phoneNumber, setPhoneNumber] = useState(state?.phoneNumber || '');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const phoneForm = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { phoneNumber: '' },
  });

  const otpForm = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { code: '' },
  });

  const profileForm = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: { fullName: '' },
  });

  const handleSendOtp = async (data: { phoneNumber: string }) => {
    setIsLoading(true);
    try {
      const response = await authApi.sendOtp(data.phoneNumber);
      setPhoneNumber(data.phoneNumber);
      setStep('otp');

      if (response.data.data.code) {
        toast.success(`OTP: ${response.data.data.code}`, { duration: 10000 });
      } else {
        toast.success('OTP sent to your phone');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (data: { code: string }) => {
    setIsLoading(true);
    try {
      const response = await authApi.verifyOtp(phoneNumber, data.code);
      const result = response.data.data;

      if (!result.isNewUser) {
        // User already exists, redirect to login
        setAuth({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        toast.success('Welcome back!');
        navigate('/', { replace: true });
      } else {
        setOtpCode(data.code);
        setStep('profile');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: { fullName: string }) => {
    setIsLoading(true);
    try {
      const response = await authApi.register({
        phoneNumber,
        fullName: data.fullName,
        otpCode,
      });

      const result = response.data.data;
      setAuth({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      toast.success('Account created! You have $10,000 demo credits.');
      navigate('/', { replace: true });
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="relative">
            <TrendingUp className="h-10 w-10 text-primary-500" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-success-500 rounded-full animate-pulse"></span>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-2xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
              PredictArabia
            </span>
            <span className="text-xs text-gray-500 -mt-1">Prediction Markets</span>
          </div>
        </Link>

        <div className="card p-8">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['phone', 'otp', 'profile'].map((s, i) => (
              <div
                key={s}
                className={`h-2 w-12 rounded ${
                  ['phone', 'otp', 'profile'].indexOf(step) >= i
                    ? 'bg-primary-500'
                    : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          <h1 className="text-2xl font-bold text-center mb-6">
            {step === 'phone' && 'Create Account'}
            {step === 'otp' && 'Verify Phone'}
            {step === 'profile' && 'Complete Profile'}
          </h1>

          {step === 'phone' && (
            <form onSubmit={phoneForm.handleSubmit(handleSendOtp)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    {...phoneForm.register('phoneNumber')}
                    type="tel"
                    placeholder="+961 70 123 456"
                    className="input pl-10"
                  />
                </div>
                {phoneForm.formState.errors.phoneNumber && (
                  <p className="text-danger-500 text-sm mt-1">
                    {phoneForm.formState.errors.phoneNumber.message}
                  </p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Sending...' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              <p className="text-sm text-gray-400 text-center mb-4">
                Enter the code sent to <span className="text-white">{phoneNumber}</span>
              </p>

              <div>
                <input
                  {...otpForm.register('code')}
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  className="input text-center text-2xl tracking-widest font-mono"
                />
                {otpForm.formState.errors.code && (
                  <p className="text-danger-500 text-sm mt-1">
                    {otpForm.formState.errors.code.message}
                  </p>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Verifying...' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={() => setStep('phone')}
                className="btn-ghost w-full text-sm"
              >
                Change phone number
              </button>
            </form>
          )}

          {step === 'profile' && (
            <form onSubmit={profileForm.handleSubmit(handleRegister)} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <input
                    {...profileForm.register('fullName')}
                    type="text"
                    placeholder="Enter your full name"
                    className="input pl-10"
                  />
                </div>
                {profileForm.formState.errors.fullName && (
                  <p className="text-danger-500 text-sm mt-1">
                    {profileForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>

              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-400">
                  KYC verification will be required for withdrawals. You can upload your ID later.
                </p>
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full">
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t border-gray-700 text-center">
            <p className="text-gray-400 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300">
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
