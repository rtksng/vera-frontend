import { Redirect } from 'expo-router';

// Default route for auth group - redirect to sign-in
export default function AuthIndex() {
  return <Redirect href="/(auth)/sign-in" />;
}
