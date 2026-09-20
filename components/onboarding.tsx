"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "formwork-onboarding-complete";

export function OnboardingCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(window.localStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  const finish = () => {
    window.localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  };

  if (!visible) return null;

  return <section className="onboarding-card card" aria-labelledby="onboarding-title"><div className="onboarding-header"><div><div className="eyebrow">New here?</div><h2 id="onboarding-title">Three simple steps.</h2><p>Use Formwork to follow your plan without overthinking it.</p></div><button className="button ghost small" onClick={finish}>Skip guide</button></div><div className="onboarding-steps"><div className="onboarding-step"><span>1</span><div><strong>Open today’s plan</strong><p>See exactly what you need to do today.</p></div></div><div className="onboarding-step"><span>2</span><div><strong>Log your sets</strong><p>Add your weight, reps, and RIR as you go.</p></div></div><div className="onboarding-step"><span>3</span><div><strong>Track progress</strong><p>Come back to see your consistency and trends.</p></div></div></div><div className="onboarding-footer"><Link className="button primary" href="/plan/sambhav" onClick={finish}>Open today’s plan</Link><button className="button ghost" onClick={finish}>I understand</button></div></section>;
}
