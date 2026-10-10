import { SignUp } from '@clerk/nextjs'


const page = () => {
  return (
    <SignUp
      path="/sign-up"
      routing="path"
      fallbackRedirectUrl="/placement-workspace"
      signInUrl="/sign-in"
    />
  )
}

export default page;
