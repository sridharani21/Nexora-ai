import { SignIn } from '@clerk/nextjs'


const page = () => {
  return (
    <SignIn
      path="/sign-in"
      routing="path"
      fallbackRedirectUrl="/placement-workspace"
      signUpUrl="/sign-up"
    />
  )
}

export default page;
