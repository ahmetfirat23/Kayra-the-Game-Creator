import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#E8DCC8] dark:bg-gray-900">
      <SignIn />
    </div>
  )
}

