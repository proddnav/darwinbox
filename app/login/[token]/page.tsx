'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface LoginStatus {
  status: 'loading' | 'ready' | 'logging_in' | 'success' | 'error';
  message: string;
}

export default function LoginPage() {
  const params = useParams();
  const token = params.token as string;
  const [loginStatus, setLoginStatus] = useState<LoginStatus>({
    status: 'loading',
    message: 'Validating token...',
  });

  useEffect(() => {
    if (!token) {
      setLoginStatus({
        status: 'error',
        message: 'Invalid token',
      });
      return;
    }

    // Validate token and get session info
    validateToken(token);
  }, [token]);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch(`/api/login/validate?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        setLoginStatus({
          status: 'error',
          message: data.message || 'Invalid or expired token',
        });
        return;
      }

      // Token is valid, show login interface
      setLoginStatus({
        status: 'ready',
        message: 'Please log in to Darwinbox',
      });

      // Start monitoring login status
      monitorLoginStatus(data.sessionId);
    } catch (error) {
      setLoginStatus({
        status: 'error',
        message: 'Failed to validate token. Please try again.',
      });
    }
  };

  const monitorLoginStatus = async (sessionId: string) => {
    // Poll for login status every 2 seconds
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/login/status?sessionId=${sessionId}`);
        const data = await response.json();

        if (data.loggedIn) {
          clearInterval(interval);
          setLoginStatus({
            status: 'success',
            message: 'Login successful! Processing your expense...',
          });

          // Redirect after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        }
      } catch (error) {
        console.error('Error checking login status:', error);
      }
    }, 2000);

    // Stop polling after 15 minutes (token expiry)
    setTimeout(() => {
      clearInterval(interval);
      if (loginStatus.status !== 'success') {
        setLoginStatus({
          status: 'error',
          message: 'Login timeout. Please request a new login link.',
        });
      }
    }, 15 * 60 * 1000);
  };

  const openDarwinboxLogin = () => {
    setLoginStatus({
      status: 'logging_in',
      message: 'Opening Darwinbox login...',
    });

    // Open Darwinbox in new window/tab
    window.open('https://zepto.darwinbox.in/', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Darwinbox Login
          </h1>
          <p className="text-gray-600">
            {loginStatus.message}
          </p>
        </div>

        {loginStatus.status === 'loading' && (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {loginStatus.status === 'ready' && (
          <div className="space-y-4">
            <button
              onClick={openDarwinboxLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Open Darwinbox Login
            </button>
            <p className="text-sm text-gray-500 text-center">
              After logging in, this window will automatically detect your login
            </p>
          </div>
        )}

        {loginStatus.status === 'logging_in' && (
          <div className="space-y-4">
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-center text-gray-600 text-sm">
              Please complete the login in the Darwinbox window that opened.
              <br />
              This page will automatically update when you're logged in.
            </p>
          </div>
        )}

        {loginStatus.status === 'success' && (
          <div className="text-center py-4">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-green-600 font-semibold">
              {loginStatus.message}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This window will close automatically...
            </p>
          </div>
        )}

        {loginStatus.status === 'error' && (
          <div className="text-center py-4">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-red-600 font-semibold">
              {loginStatus.message}
            </p>
            <button
              onClick={() => window.close()}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

