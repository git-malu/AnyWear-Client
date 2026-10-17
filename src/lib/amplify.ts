import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
      identityPoolId: '',
      signUpVerificationMethod: 'code',
      loginWith: {
        email: true,
      },
      userAttributes: {
        email: {
          required: true,
        },
      },
    }
  }
});

export default Amplify;