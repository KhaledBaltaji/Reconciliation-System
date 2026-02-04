import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { TrendingUp, Phone, ArrowRight } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../stores/auth';

const phoneSchema = z.object({
  phoneNumber: z.string().min(10, 'Enter a valid phone number'),
});

const otpSchema = z.object({
  code: z.string().length(6, 'OTP must be 6 digits'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const phoneForm = useForm({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  });

  const otpForm = useForm({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  const handleSendOtp = async (data: { phoneNumber: string }) => {
    setIsLoading(true);
    try {
      const response = await authApi.sendOtp(data.phoneNumber);
      setPhoneNumber(data.phoneNumber);
      setStep('otp');

      // Show OTP in development
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

      if (result.isNewUser) {
        // Redirect to registration
        navigate('/register', { state: { phoneNumber, verificationToken: result.verificationToken } });
      } else {
        // Login successful
        setAuth({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        toast.success('Welcome back!');
        navigate(from, { replace: true });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Invalid OTP');
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
          <h1 className="text-2xl font-bold text-center mb-6">
            {step === 'phone' ? 'Welcome Back' : 'Enter OTP'}
          </h1>

          {step === 'phone' ? (
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

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={otpForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
              <p className="text-sm text-gray-400 text-center mb-4">
                We sent a code to <span className="text-white">{phoneNumber}</span>
              </p>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Verification Code</label>
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

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full"
              >
                {isLoading ? 'Verifying...' : 'Verify & Login'}
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

          <div className="mt-6 pt-6 border-t border-gray-700 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-400 hover:text-primary-300">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
