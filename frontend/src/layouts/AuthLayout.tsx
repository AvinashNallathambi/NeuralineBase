import React from 'react';
import { Outlet } from 'react-router-dom';
import { Typography } from 'antd';
import logo from '../assets/logo.png';

const { Title, Text } = Typography;

const AuthLayout: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* Left Panel - Branding */}
      <div
        style={{
          flex: '0 0 50%',
          background: 'linear-gradient(135deg, #0D7C8A 0%, #064E57 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="auth-left-panel"
      >
        {/* Decorative background circles */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: '10%',
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        />

        {/* Logo & Text */}
        <div
          style={{
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          <img
            src={logo}
            alt="Neuraline"
            style={{
              width: 80,
              height: 80,
              objectFit: 'contain',
              marginBottom: 24,
              filter: 'brightness(0) invert(1)',
            }}
          />
          <Title
            level={1}
            style={{
              color: '#ffffff',
              margin: '0 0 12px 0',
              fontSize: 42,
              fontWeight: 700,
              letterSpacing: '1px',
            }}
          >
            Neuraline
          </Title>
          <Text
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: 18,
              fontWeight: 300,
              letterSpacing: '0.5px',
            }}
          >
            Intelligent Healthcare Platform
          </Text>

          {/* Feature highlights */}
          <div
            style={{
              marginTop: 64,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'flex-start',
              maxWidth: 320,
            }}
          >
            {[
              'AI-Powered Clinical Decision Support',
              'Seamless EHR Integration',
              'HIPAA Compliant & Secure',
              'Real-time Collaboration',
            ].map((feature, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.6)',
                    flexShrink: 0,
                  }}
                />
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontSize: 14,
                  }}
                >
                  {feature}
                </Text>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form Area */}
      <div
        style={{
          flex: '0 0 50%',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 64px',
          overflowY: 'auto',
        }}
        className="auth-right-panel"
      >
        <div
          style={{
            width: '100%',
            // maxWidth: 420,
          }}
        >
          <Outlet />
        </div>
      </div>

      {/* Responsive style overrides */}
      <style>{`
        @media (max-width: 768px) {
          .auth-left-panel {
            display: none !important;
          }
          .auth-right-panel {
            flex: 1 1 100% !important;
            padding: 24px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default AuthLayout;
