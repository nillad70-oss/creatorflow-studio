import { NextResponse } from 'next/server'

const PROTECTED = ['/dashboard', '/onboarding', '/scripts', '/teleprompter', '/planner', '/captions', '/library', '/settings']
const AUTH_ROUTES = ['/login', '/signup']

export async function middleware(request) {
  const path = request.nextUrl.pathname
  const session = request.cookies.get('sb-ndcwggugyuixpnzeyfmg-auth-token')

  if (!session && PROTECTED.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && AUTH_ROUTES.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}