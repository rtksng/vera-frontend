import { Redirect } from 'expo-router';

export default function SignUpScreen() {
  return <Redirect href={{ pathname: '/(auth)/auth', params: { tab: 'sign-up' } }} />;
}
