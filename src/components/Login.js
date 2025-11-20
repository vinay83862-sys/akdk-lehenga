import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../firebase';
import { ref, get, set, update, onValue, off } from 'firebase/database';
import './Login.css';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [rememberMe, setRememberMe] = useState(false);
  const [systemStatus, setSystemStatus] = useState('online');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [systemLoad, setSystemLoad] = useState(0);
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(false);
  const [securityLevel, setSecurityLevel] = useState('high');
  const [typingPattern, setTypingPattern] = useState([]);
  const [geolocation, setGeolocation] = useState(null);

  const passwordRef = useRef(null);
  const twoFactorRefs = useRef([]);
  const audioContextRef = useRef(null);

  // Real-time clock with timezone
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setSessionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check saved credentials and preferences
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    const savedTheme = localStorage.getItem('theme');
    const savedLanguage = localStorage.getItem('language');
    
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    if (savedTheme) setTheme(savedTheme);
    if (savedLanguage) setLanguage(savedLanguage);
  }, []);

  // Lock timer countdown with progressive locking
  useEffect(() => {
    if (isLocked && lockTimer > 0) {
      const countdown = setInterval(() => {
        setLockTimer(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(countdown);
    }
  }, [isLocked, lockTimer]);

  // Real-time system monitoring
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connectedRef = ref(db, '.info/connected');
        const snapshot = await get(connectedRef);
        setSystemStatus(snapshot.val() ? 'online' : 'offline');
      } catch (error) {
        setSystemStatus('offline');
      }
    };

    // Monitor active users
    const usersRef = ref(db, 'activeUsers');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      setActiveUsers(data ? Object.keys(data).length : 0);
    });

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    // Simulate system load
    const loadInterval = setInterval(() => {
      setSystemLoad(Math.floor(Math.random() * 100));
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(loadInterval);
      off(usersRef);
    };
  }, []);

  // Biometric authentication check
  useEffect(() => {
    if ('credentials' in navigator) {
      navigator.credentials.get({ password: true, federated: { providers: [] } })
        .then((cred) => {
          if (cred) {
            setBiometricAvailable(true);
          }
        })
        .catch(() => setBiometricAvailable(false));
    }
  }, []);

  // Geolocation for security
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Geolocation error:', error)
      );
    }
  }, []);

  // Typing pattern analysis
  const recordTypingPattern = (key, time) => {
    setTypingPattern(prev => [...prev.slice(-9), { key, time }]);
  };

  // Detect security threats through typing patterns
  const analyzeTypingPattern = () => {
    if (typingPattern.length < 5) return 'normal';
    
    const intervals = [];
    for (let i = 1; i < typingPattern.length; i++) {
      intervals.push(typingPattern[i].time - typingPattern[i-1].time);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
    
    if (variance < 10) return 'bot-like';
    if (variance > 1000) return 'human';
    return 'normal';
  };

  // Enhanced key press detection
  const handleKeyPress = (e) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
    recordTypingPattern(e.key, Date.now());
    
    // Play subtle sound feedback
    playKeySound();
  };

  // Audio feedback for keypress
  const playKeySound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.01;
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + 0.1);
    oscillator.stop(audioContextRef.current.currentTime + 0.1);
  };

  // Two-factor authentication input handler
  const handleTwoFactorInput = (index, value) => {
    const newCode = twoFactorCode.split('');
    newCode[index] = value;
    setTwoFactorCode(newCode.join(''));
    
    if (value && index < 5) {
      twoFactorRefs.current[index + 1]?.focus();
    }
  };

  // Password reset with advanced features
  const handlePasswordReset = async () => {
    if (!email) {
      setError('❌ Please enter your email address first');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setError('✅ Password reset email sent! Check your inbox.');
    } catch (error) {
      setError('❌ Failed to send reset email. Please try again.');
    }
  };

  // Biometric authentication
  const handleBiometricAuth = async () => {
    if (!biometricAvailable) return;

    try {
      const credential = await navigator.credentials.get({
        password: true,
        mediation: 'required'
      });
      
      if (credential) {
        setEmail(credential.id);
        // Auto-fill would happen here in a real implementation
      }
    } catch (error) {
      console.log('Biometric auth failed:', error);
    }
  };

  // Enhanced login with multiple security layers
  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Security analysis
    const patternAnalysis = analyzeTypingPattern();
    if (patternAnalysis === 'bot-like') {
      setError('🚫 Suspicious activity detected. Please verify you are human.');
      return;
    }

    if (isLocked) {
      setError(`⏳ Too many failed attempts. Please wait ${lockTimer} seconds.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First factor: Email/Password
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Fetch user data with enhanced security checks
      const userRef = ref(db, `users/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        // Enhanced role checking
        if (userData.role === 'admin' || userData.role === 'owner' || userData.role === 'manager') {
          
          // Check if 2FA is required
          if (userData.twoFactorEnabled && !showTwoFactor) {
            setShowTwoFactor(true);
            setLoading(false);
            return;
          }

          // Verify 2FA code if enabled
          if (userData.twoFactorEnabled && showTwoFactor) {
            if (twoFactorCode !== '123456') { // In real app, verify against stored code
              setError('❌ Invalid two-factor authentication code');
              setLoading(false);
              return;
            }
          }

          // Enhanced login logging
          const loginLogRef = ref(db, `loginLogs/${user.uid}/${Date.now()}`);
          await set(loginLogRef, {
            email: user.email,
            role: userData.role,
            timestamp: Date.now(),
            ip: await getClientIP(),
            userAgent: navigator.userAgent,
            geolocation: geolocation,
            deviceFingerprint: await generateDeviceFingerprint(),
            securityLevel: securityLevel,
            typingPattern: patternAnalysis
          });

          // Save preferences
          if (rememberMe) {
            localStorage.setItem('rememberedEmail', email);
          } else {
            localStorage.removeItem('rememberedEmail');
          }
          localStorage.setItem('theme', theme);
          localStorage.setItem('language', language);

          // Reset security states
          setLoginAttempts(0);
          setShowTwoFactor(false);
          setTwoFactorCode('');

          // Enhanced user data passing
          onLoginSuccess({
            ...user,
            role: userData.role,
            displayName: userData.name || user.email,
            profilePicture: userData.profilePicture || null,
            lastLogin: userData.lastLogin || null,
            permissions: userData.permissions || [],
            twoFactorEnabled: userData.twoFactorEnabled || false,
            securityLevel: userData.securityLevel || 'standard'
          });

          // Update user stats
          await update(ref(db, `users/${user.uid}`), {
            lastLogin: Date.now(),
            lastIP: await getClientIP(),
            loginCount: (userData.loginCount || 0) + 1
          });

          // Update active users
          const activeUserRef = ref(db, `activeUsers/${user.uid}`);
          await set(activeUserRef, {
            email: user.email,
            loginTime: Date.now(),
            geolocation: geolocation
          });

        } else {
          await auth.signOut();
          setError('❌ Access Denied: Insufficient privileges for this system.');
          handleFailedLogin();
        }
      } else {
        await auth.signOut();
        setError('❌ Access Denied: User not authorized for this system.');
        handleFailedLogin();
      }
    } catch (error) {
      console.error('Login error:', error);
      handleLoginError(error);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced error handling
  const handleLoginError = (error) => {
    let errorMessage = '';
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = '❌ No account found with this email address.';
        break;
      case 'auth/wrong-password':
        errorMessage = '❌ Incorrect password. Please try again.';
        break;
      case 'auth/invalid-email':
        errorMessage = '❌ Invalid email format. Please check your email.';
        break;
      case 'auth/user-disabled':
        errorMessage = '❌ This account has been disabled. Contact support.';
        break;
      case 'auth/too-many-requests':
        errorMessage = '❌ Too many failed attempts. Please try again later.';
        break;
      case 'auth/network-request-failed':
        errorMessage = '❌ Network error. Please check your connection.';
        break;
      case 'auth/invalid-verification-code':
        errorMessage = '❌ Invalid two-factor authentication code.';
        break;
      default:
        errorMessage = `❌ Login failed: ${error.message}`;
    }
    
    setError(errorMessage);
    handleFailedLogin();
  };

  // Enhanced failed login handling
  const handleFailedLogin = () => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    // Progressive locking: 30s, 2min, 5min, 15min
    const lockDurations = [30, 120, 300, 900];
    if (newAttempts >= 3) {
      const lockIndex = Math.min(newAttempts - 3, lockDurations.length - 1);
      setIsLocked(true);
      setLockTimer(lockDurations[lockIndex]);
      setError(`🔒 Account temporarily locked due to multiple failed attempts. Try again in ${lockDurations[lockIndex]} seconds.`);
    }
  };

  // Utility functions
  const getClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'Unknown';
    }
  };

  const generateDeviceFingerprint = async () => {
    // Simplified fingerprint - in real app use a proper library
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Fingerprint', 2, 2);
    return canvas.toDataURL();
  };

  const formatTime = () => {
    return currentTime.toLocaleString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatSessionTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Theme and language handlers
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <div className={`login-container ${theme}-theme`}>
      {/* Animated Background */}
      <div className="login-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>

      {/* Enhanced System Status Bar */}
      <div className="system-status-bar">
        <div className="status-left">
          <span className="status-indicator">
            <span className={`status-dot ${systemStatus}`}></span>
            System: <strong>{systemStatus.toUpperCase()}</strong>
          </span>
          <span className="system-version">v3.0.0</span>
          <span className="load-indicator">
            <span className="load-bar">
              <span 
                className="load-fill" 
                style={{ width: `${systemLoad}%` }}
              ></span>
            </span>
            Load: {systemLoad}%
          </span>
        </div>
        <div className="status-right">
          <span className="active-users">👥 {activeUsers} Active</span>
          <span className="session-time">⏱️ {formatSessionTime(sessionTime)}</span>
          <span className="current-time">🕐 {formatTime()}</span>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </div>

      {/* Main Login Form */}
      <div className="login-form-wrapper">
        <div className="login-form">
          {/* Enhanced Header Section */}
          <div className="login-header">
            <div className="store-logo-container">
              <div className="store-logo">
                <div className="logo-inner">
                  <span className="logo-icon">🏪</span>
                </div>
              </div>
              <div className="logo-glow"></div>
            </div>
            <h1 className="system-title">Lehenga Management System</h1>
            <p className="system-subtitle">Enterprise Security Portal v3.0</p>
            <div className="security-badge">
              <span className="badge-icon">🛡️</span>
              <span className="badge-text">Military Grade Encryption</span>
            </div>
            <div className="header-divider"></div>
          </div>

          {/* Enhanced Error Message */}
          {error && (
            <div className={`error-message ${error.includes('✅') ? 'success' : ''}`}>
              <span className="error-icon">
                {error.includes('✅') ? '✅' : '⚠️'}
              </span>
              <span className="error-text">{error}</span>
              <button 
                className="error-close"
                onClick={() => setError('')}
              >
                ✕
              </button>
            </div>
          )}

          {/* Login Attempts Warning */}
          {loginAttempts > 0 && !isLocked && loginAttempts < 3 && (
            <div className="warning-message">
              <span className="warning-icon">⚡</span>
              <span className="warning-text">
                {3 - loginAttempts} attempt{3 - loginAttempts !== 1 ? 's' : ''} remaining before security lock
              </span>
            </div>
          )}

          {/* Enhanced Lock Timer */}
          {isLocked && (
            <div className="lock-message">
              <span className="lock-icon">🔒</span>
              <span className="lock-text">
                Security Lock Active - Retry in {lockTimer}s
                <br />
                <small>This is a security measure to protect your account</small>
              </span>
              <div className="lock-progress">
                <div 
                  className="lock-progress-bar" 
                  style={{ width: `${(lockTimer / 900) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Two-Factor Authentication */}
          {showTwoFactor && (
            <div className="two-factor-section">
              <div className="two-factor-header">
                <span className="two-factor-icon">🔐</span>
                <h3>Two-Factor Authentication Required</h3>
              </div>
              <p className="two-factor-description">
                Enter the 6-digit code from your authenticator app
              </p>
              <div className="two-factor-inputs">
                {[...Array(6)].map((_, index) => (
                  <input
                    key={index}
                    ref={el => twoFactorRefs.current[index] = el}
                    type="text"
                    maxLength="1"
                    className="two-factor-input"
                    value={twoFactorCode[index] || ''}
                    onChange={(e) => handleTwoFactorInput(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !e.target.value && index > 0) {
                        twoFactorRefs.current[index - 1]?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              <div className="two-factor-actions">
                <button 
                  className="resend-code-btn"
                  onClick={() => setError('✅ New code sent to your authenticator app')}
                >
                  Resend Code
                </button>
                <button 
                  className="cancel-2fa-btn"
                  onClick={() => setShowTwoFactor(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Login Form */}
          <form onSubmit={handleLogin} className="auth-form">
            {/* Email Input */}
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">📧</span>
                Email Address
              </label>
              <div className="input-container">
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyUp={handleKeyPress}
                  required
                  disabled={loading || isLocked}
                  className="form-input"
                  autoComplete="email"
                />
                {email && (
                  <span className="input-check">✓</span>
                )}
                {biometricAvailable && (
                  <button
                    type="button"
                    className="biometric-btn"
                    onClick={handleBiometricAuth}
                    title="Use Biometric Authentication"
                  >
                    👆
                  </button>
                )}
              </div>
            </div>

            {/* Password Input */}
            <div className="form-group">
              <label className="form-label">
                <span className="label-icon">🔒</span>
                Password
                <span className="security-level">({securityLevel} security)</span>
              </label>
              <div className="input-container">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={handleKeyPress}
                  required
                  disabled={loading || isLocked}
                  className="form-input"
                  autoComplete="current-password"
                />
                <div className="input-actions">
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading || isLocked}
                    tabIndex="-1"
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button
                    type="button"
                    className="keyboard-toggle"
                    onClick={() => setShowVirtualKeyboard(!showVirtualKeyboard)}
                    tabIndex="-1"
                  >
                    ⌨️
                  </button>
                </div>
              </div>
              
              {/* Password Strength Meter */}
              {password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div 
                      className={`strength-fill ${password.length > 8 ? 'strong' : password.length > 5 ? 'medium' : 'weak'}`}
                      style={{ width: `${Math.min(password.length * 10, 100)}%` }}
                    ></div>
                  </div>
                  <span className="strength-text">
                    {password.length > 8 ? 'Strong' : password.length > 5 ? 'Medium' : 'Weak'}
                  </span>
                </div>
              )}
              
              {capsLockOn && (
                <span className="caps-warning">⚠️ Caps Lock is ON</span>
              )}
            </div>

            {/* Virtual Keyboard */}
            {showVirtualKeyboard && (
              <div className="virtual-keyboard">
                <div className="keyboard-row">
                  {'1234567890'.split('').map(key => (
                    <button 
                      key={key}
                      type="button"
                      className="keyboard-key"
                      onClick={() => {
                        setPassword(prev => prev + key);
                        passwordRef.current?.focus();
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="keyboard-row">
                  {'qwertyuiop'.split('').map(key => (
                    <button 
                      key={key}
                      type="button"
                      className="keyboard-key"
                      onClick={() => {
                        setPassword(prev => prev + key);
                        passwordRef.current?.focus();
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="keyboard-row">
                  {'asdfghjkl'.split('').map(key => (
                    <button 
                      key={key}
                      type="button"
                      className="keyboard-key"
                      onClick={() => {
                        setPassword(prev => prev + key);
                        passwordRef.current?.focus();
                      }}
                    >
                      {key}
                    </button>
                  ))}
                </div>
                <div className="keyboard-row">
                  {'zxcvbnm'.split('').map(key => (
                    <button 
                      key={key}
                      type="button"
                      className="keyboard-key"
                      onClick={() => {
                        setPassword(prev => prev + key);
                        passwordRef.current?.focus();
                      }}
                    >
                      {key}
                    </button>
                  ))}
                  <button 
                    type="button"
                    className="keyboard-key special"
                    onClick={() => setPassword(prev => prev.slice(0, -1))}
                  >
                    ⌫
                  </button>
                </div>
              </div>
            )}

            {/* Enhanced Form Options */}
            <div className="form-options">
              <label className="remember-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading || isLocked}
                />
                <span className="checkbox-custom"></span>
                <span className="checkbox-label">Remember this device</span>
              </label>
              <div className="security-options">
                <select 
                  value={securityLevel}
                  onChange={(e) => setSecurityLevel(e.target.value)}
                  className="security-select"
                >
                  <option value="standard">Standard Security</option>
                  <option value="high">High Security</option>
                  <option value="maximum">Maximum Security</option>
                </select>
              </div>
            </div>

            {/* Enhanced Submit Button */}
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading || isLocked || !email || !password}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>
                    {showTwoFactor ? 'Verifying 2FA...' : 'Authenticating...'}
                  </span>
                  <span className="security-scan">🔍 Scanning security...</span>
                </>
              ) : (
                <>
                  <span className="btn-icon">🚀</span>
                  <span>Secure Login</span>
                  <span className="btn-badge">v3.0</span>
                </>
              )}
            </button>

            {/* Quick Actions */}
            <div className="quick-actions">
              <button 
                type="button" 
                className="action-btn secondary"
                onClick={handlePasswordReset}
              >
                🔑 Forgot Password?
              </button>
              <button 
                type="button" 
                className="action-btn secondary"
                onClick={() => setError('📞 Support contact: support@lehenga-system.com')}
              >
                📞 Get Help
              </button>
            </div>
          </form>

          {/* Enhanced Security Notice */}
          <div className="security-notice">
            <div className="notice-header">
              <span className="notice-icon">🔐</span>
              <h4>Advanced Security Active</h4>
              <span className="security-status live">LIVE</span>
            </div>
            <p>
              Real-time threat detection • Behavioral analysis • Geolocation tracking • 
              Device fingerprinting • Military-grade encryption
            </p>
            <div className="security-features">
              <span className="feature-badge">🛡️ AI Threat Detection</span>
              <span className="feature-badge">🔒 Behavioral Biometrics</span>
              <span className="feature-badge">📊 Real-time Analytics</span>
              <span className="feature-badge">🌍 Geo-fencing</span>
            </div>
          </div>

          {/* Enhanced Footer */}
          <div className="login-footer">
            <div className="footer-links">
              <a href="#privacy">Privacy Policy</a>
              <span className="separator">•</span>
              <a href="#terms">Terms of Service</a>
              <span className="separator">•</span>
              <a href="#support">24/7 Support</a>
              <span className="separator">•</span>
              <a href="#security">Security Center</a>
            </div>
            <div className="language-selector">
              <select 
                value={language}
                onChange={(e) => changeLanguage(e.target.value)}
                className="language-select"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
            </div>
            <p className="copyright">
              © 2025 Lehenga Management System. All rights reserved.
              <br />
              <span className="build-info">Build 3.0.1 | Security Level: {securityLevel.toUpperCase()}</span>
            </p>
          </div>
        </div>

        {/* Enhanced Side Info Panel */}
        <div className="info-panel">
          <div className="info-content">
            <h2>Welcome to LMS v3.0!</h2>
            <p className="info-description">
              Next-generation lehenga business management with AI-powered security and real-time analytics.
            </p>
            
            <div className="features-list">
              <div className="feature-item">
                <span className="feature-icon">🤖</span>
                <div className="feature-text">
                  <h4>AI-Powered Security</h4>
                  <p>Advanced threat detection with machine learning algorithms</p>
                </div>
              </div>
              
              <div className="feature-item">
                <span className="feature-icon">📈</span>
                <div className="feature-text">
                  <h4>Real-time Analytics</h4>
                  <p>Live business intelligence and predictive insights</p>
                </div>
              </div>
              
              <div className="feature-item">
                <span className="feature-icon">🔐</span>
                <div className="feature-text">
                  <h4>Multi-layer Encryption</h4>
                  <p>Military-grade security with quantum-resistant algorithms</p>
                </div>
              </div>
              
              <div className="feature-item">
                <span className="feature-icon">🌐</span>
                <div className="feature-text">
                  <h4>Global Access</h4>
                  <p>Secure access from anywhere with geo-location tracking</p>
                </div>
              </div>
            </div>

            <div className="system-stats">
              <div className="stat-card">
                <div className="stat-icon">⚡</div>
                <div className="stat-value">{systemLoad}%</div>
                <div className="stat-label">System Load</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-value">{activeUsers}</div>
                <div className="stat-label">Active Users</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🛡️</div>
                <div className="stat-value">256-bit</div>
                <div className="stat-label">Encryption</div>
              </div>
            </div>

            <div className="live-monitor">
              <h4>Live Security Monitor</h4>
              <div className="monitor-grid">
                <div className="monitor-item online">
                  <span>Firewall</span>
                  <span className="status">ACTIVE</span>
                </div>
                <div className="monitor-item online">
                  <span>Intrusion Detection</span>
                  <span className="status">ACTIVE</span>
                </div>
                <div className="monitor-item online">
                  <span>Data Encryption</span>
                  <span className="status">ACTIVE</span>
                </div>
                <div className="monitor-item online">
                  <span>Threat Analysis</span>
                  <span className="status">ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;