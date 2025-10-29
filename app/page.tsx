import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="container z-40 bg-background">
        <div className="flex h-20 items-center justify-between py-6">
          <Link href="/" className="flex items-center space-x-2">
            <Icons.logo className="h-8 w-8 text-primary" />
            <span className="font-headline text-2xl font-bold text-primary">
              SmartDine
            </span>
          </Link>
          <nav>
            <Button asChild>
              <Link href="/login">Login</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="space-y-6 pb-8 pt-6 md:pb-12 md:pt-10 lg:py-32">
          <div className="container flex max-w-[64rem] flex-col items-center gap-4 text-center">
            <h1 className="font-headline text-3xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
              The smart way to manage your restaurant
            </h1>
            <p className="max-w-[42rem] leading-normal text-muted-foreground sm:text-xl sm:leading-8">
              From point-of-sale to menu management, SmartDine provides an
              all-in-one solution to streamline your operations and delight your
              customers.
            </p>
            <div className="space-x-4">
              <Button asChild size="lg">
                <Link href="/signup">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Login</Link>
              </Button>
            </div>
          </div>
        </section>
        <section className="container relative">
            <div className="mx-auto rounded-xl shadow-2xl overflow-hidden">
                <Image 
                    src="https://picsum.photos/seed/restaurant/1200/600"
                    alt="SmartDine Dashboard"
                    width={1200}
                    height={600}
                    className="w-full"
                    data-ai-hint="restaurant interior"
                />
            </div>
        </section>
      </main>
      <footer className="py-6 md:px-8 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by You. Powered by AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
