import { useState } from "react";
import { createTopUpCheckout } from "@/server/api/credits/top-up";
import { calculateCredits } from "@/lib/credit-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function initialPricing() {
  try {
    return calculateCredits(10);
  } catch {
    return null;
  }
}

export function BuyCreditsModal({ isOpen, onClose }: BuyCreditsModalProps) {
  const [amount, setAmount] = useState("10");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<ReturnType<typeof calculateCredits> | null>(
    initialPricing,
  );

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setError(null);

    const euros = parseFloat(value);
    if (!isNaN(euros) && euros >= 10 && euros <= 10000) {
      try {
        const calc = calculateCredits(euros);
        setPricing(calc);
      } catch {
        setPricing(null);
      }
    } else {
      setPricing(null);
    }
  };

  const handleTopUp = async () => {
    const euros = parseFloat(amount);

    if (isNaN(euros)) {
      setError("Enter a valid amount");
      return;
    }

    if (euros < 10) {
      setError("Minimum top-up is €10");
      return;
    }

    if (euros > 10000) {
      setError("Maximum top-up is €10,000");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const result = await createTopUpCheckout({ data: { amountEuros: euros } });
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create checkout",
      );
      setIsLoading(false);
    }
  };

  const getTierLabel = (markup: number): string => {
    if (markup === 3.5) return "Entry Rate";
    if (markup === 3.0) return "Standard Rate";
    if (markup === 2.5) return "Premium Rate";
    return "Unknown";
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title="Top Up Credits" className="w-full max-w-md">
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-fg">
              Top-Up Amount (€)
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              min={10}
              max={10000}
              step={5}
              placeholder="10"
              className="w-full text-lg"
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-muted">
              Minimum: €10 • Maximum: €10,000
            </p>
          </div>

          {pricing ? (
            <div className="rounded-xl bg-elevated p-4 shadow-[0_0_0_1px_rgb(99_102_241/0.28)]">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted">You&apos;ll receive</p>
                  <p className="mt-1 font-display text-2xl font-semibold text-indigo-glow">
                    {pricing.creditsAwarded.toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 text-xs text-muted">credits</p>
                </div>
                <div className="text-right">
                  <p className="rounded bg-indigo/20 px-2 py-1 text-xs font-semibold text-indigo-glow">
                    {getTierLabel(pricing.margin)}
                  </p>
                  <p className="mt-2 text-xs text-muted">{pricing.margin}× rate</p>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs text-muted">
                  1000 credits = €1 • Cost per credit: €
                  {pricing.costPerCredit.toFixed(5)}
                </p>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg bg-elevated p-3 shadow-[0_0_0_1px_rgb(245_158_11/0.28)]">
            <p className="text-xs text-fg">
              <strong>Tip:</strong> Larger amounts get better rates. €100+ gets
              the 2.5× rate.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg bg-danger/10 p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-border pt-4">
            <Button onClick={onClose} variant="outline" disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleTopUp()}
              disabled={isLoading || !pricing}
              variant="emerald"
            >
              {isLoading ? "Processing..." : "Proceed to Checkout"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Export button trigger for easy integration.
 */
export function BuyCreditsButton({ className = "" }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="emerald"
        className={className}
      >
        Buy Credits
      </Button>
      <BuyCreditsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
