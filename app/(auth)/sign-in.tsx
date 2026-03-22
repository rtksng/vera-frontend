import { Redirect } from 'expo-router';

export default function SignInScreen() {
  return <Redirect href={{ pathname: '/(auth)/auth', params: { tab: 'sign-in' } }} />;
}
