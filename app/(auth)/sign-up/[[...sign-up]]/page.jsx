import { SignUp } from '@clerk/nextjs'


const page = () => {
  return (
    <SignUp
      path="/sign-up"
      routing="path"
      forceRedirectUrl="/"
      signInUrl="/sign-in"
    />
  )
}

export default page;
