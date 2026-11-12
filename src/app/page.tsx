import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  HandCoins,
  SearchCheck,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { HeroPanel } from "@/components/investor/HeroPanel";
import { ProjectList } from "@/components/investor/ProjectList";
import { SectionHeading } from "@/components/investor/bits";

const steps = [
  {
    icon: Wallet,
    title: "Buy solar cells with PayPal",
    text: "Pick a project and choose how many cells to own. You pay with PayPal.",
  },
  {
    icon: Stethoscope,
    title: "The cells power a clinic or farm",
    text: "Once a plant is fully funded it is installed. The site pays for the electricity it uses.",
  },
  {
    icon: HandCoins,
    title: "You receive your share each month",
    text: "That income is split among owners by cells held and paid to your PayPal.",
  },
];

const agents = [
  {
    icon: SearchCheck,
    name: "Vetting agent",
    text: "Checks sunlight, expected output and risks before a project is listed.",
  },
  {
    icon: Activity,
    name: "Monitoring agent",
    text: "Compares each month's metered output with the forecast and flags problems.",
  },
  {
    icon: HandCoins,
    name: "Payout agent",
    text: "Works out each owner's share and sends it through PayPal.",
  },
  {
    icon: Bot,
    name: "Investor agent",
    text: "Invests for you within limits you set, and only after you approve.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-20 sm:space-y-24">
      <section className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Own solar cells that power African clinics and farms
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            The clinic or farm pays for the electricity it uses. You earn a share of that
            income each month, paid to your PayPal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/projects" size="lg" className="min-h-12">
              Browse projects
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/agent" size="lg" variant="secondary" className="min-h-12">
              <Bot className="size-4" aria-hidden />
              Let the agent invest for you
            </ButtonLink>
          </div>
        </div>
        <div className="hidden sm:block">
          <HeroPanel />
        </div>
      </section>

      <section aria-labelledby="how">
        <SectionHeading id="how">How it works</SectionHeading>
        <ol className="grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-card border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="tabular grid size-8 place-items-center rounded-full bg-green-soft text-sm font-semibold text-green-dark">
                  {i + 1}
                </span>
                <s.icon className="size-5 text-muted" aria-hidden />
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">
          Income depends on sunshine and how much power the site uses, so all returns are
          estimates.
        </p>
      </section>

      <section aria-labelledby="live">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionHeading id="live" intro="Sample projects for this prototype.">
            Projects
          </SectionHeading>
          <Link
            href="/projects"
            className="mb-5 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-green-dark hover:underline"
          >
            All projects
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <ProjectList headingLevel="h3" />
      </section>

      <section aria-labelledby="agents" className="rounded-card bg-surface p-6 ring-1 ring-line sm:p-8">
        <SectionHeading
          id="agents"
          intro="Four AI agents do the routine work. The numbers they use are calculated in code."
        >
          Checked at every step
        </SectionHeading>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {agents.map((a) => (
            <li key={a.name} className="flex gap-3">
              <a.icon className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
              <p>
                <span className="font-medium">{a.name}.</span>{" "}
                <span className="text-muted">{a.text}</span>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-7 border-t border-line pt-5 text-sm">
          Every monthly report and payout is listed on the{" "}
          <Link href="/operations" className="font-medium text-green-dark underline underline-offset-2">
            Operations page
          </Link>
          , so you can check them yourself.
        </p>
      </section>
    </div>
  );
}
