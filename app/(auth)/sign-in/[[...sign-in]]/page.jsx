import { SignIn } from '@clerk/nextjs'


const page = () => {
  return (
    <SignIn
      path="/sign-in"
      routing="path"
      forceRedirectUrl="/"
      signUpUrl="/sign-up"
    />
  )
}

export default page;
