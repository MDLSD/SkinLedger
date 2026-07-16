"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { saveDealAction } from "@/lib/actions/deals";
import {
  buyCostBase,
  formatMoney,
  formatPct,
  marginPct,
  profit,
} from "@/lib/deal-math";
import { CURRENCIES } from "@/lib/validation";
import type { DealDTO, PlatformDTO } from "@/lib/types";

const QUALITIES = [
  "Factory New",
  "Minimal Wear",
  "Field-Tested",
  "Well-Worn",
  "Battle-Scarred",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

const num = (s: string) => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : NaN;
};

type Props = {
  platforms: PlatformDTO[];
  itemNames: string[];
  baseCurrency: string;
  deal?: DealDTO | null;
  initialWithSell?: boolean;
  onDone: () => void;
};

export function DealForm({
  platforms,
  itemNames,
  baseCurrency,
  deal,
  initialWithSell,
  onDone,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveDealAction, {});

  const [withSell, setWithSell] = useState(
    (deal ? deal.status !== "holding" : false) || (initialWithSell ?? false),
  );

  const [buyPlatformId, setBuyPlatformId] = useState(deal?.buyPlatformId ?? "");
  const [sellPlatformId, setSellPlatformId] = useState(deal?.sellPlatformId ?? "");
  const [buyCurrency, setBuyCurrency] = useState(deal?.buyCurrency ?? baseCurrency);
  const [sellCurrency, setSellCurrency] = useState(
    deal?.sellCurrency ?? deal?.buyCurrency ?? baseCurrency,
  );

  const [quantity, setQuantity] = useState(String(deal?.quantity ?? 1));
  const [buyPrice, setBuyPrice] = useState(deal ? String(deal.buyPrice) : "");
  const [buyFeePct, setBuyFeePct] = useState(String(deal?.buyFeePct ?? 0));
  const [buyFxRate, setBuyFxRate] = useState(String(deal?.buyFxRate ?? 1));
  const [sellPrice, setSellPrice] = useState(
    deal?.sellPrice != null ? String(deal.sellPrice) : "",
  );
  const [sellFeePct, setSellFeePct] = useState(String(deal?.sellFeePct ?? 0));
  const [sellFxRate, setSellFxRate] = useState(String(deal?.sellFxRate ?? 1));

  useEffect(() => {
    if (state.success) {
      onDone();
      router.refresh();
    }
  }, [state.success, onDone, router]);

  const status = !withSell
    ? "holding"
    : deal?.status === "withdrawn_via_skin"
      ? "withdrawn_via_skin"
      : "sold";

  const calc = useMemo(() => {
    const d = {
      quantity: num(quantity),
      buyPrice: num(buyPrice),
      buyFeePct: num(buyFeePct) || 0,
      buyFxRate: buyCurrency === baseCurrency ? 1 : num(buyFxRate),
      sellPrice: withSell ? num(sellPrice) : null,
      sellFeePct: num(sellFeePct) || 0,
      sellFxRate: sellCurrency === baseCurrency ? 1 : num(sellFxRate),
    };
    if (!(d.quantity > 0) || !(d.buyPrice > 0) || !(d.buyFxRate > 0)) return null;
    const cost = buyCostBase(d);
    if (!withSell || !(d.sellPrice! > 0) || !(d.sellFxRate! > 0)) {
      return { cost, profit: null as number | null, margin: null as number | null };
    }
    return { cost, profit: profit(d), margin: marginPct(d) };
  }, [quantity, buyPrice, buyFeePct, buyFxRate, sellPrice, sellFeePct, sellFxRate, buyCurrency, sellCurrency, baseCurrency, withSell]);

  const onBuyPlatformChange = (id: string) => {
    setBuyPlatformId(id);
    const p = platforms.find((p) => p.id === id);
    if (p) setBuyFeePct(String(p.defaultBuyFeePct));
  };
  const onSellPlatformChange = (id: string) => {
    setSellPlatformId(id);
    const p = platforms.find((p) => p.id === id);
    if (p) setSellFeePct(String(p.defaultSellFeePct));
  };

  return (
    <form action={formAction} className="space-y-4">
      {deal && <input type="hidden" name="dealId" value={deal.id} />}
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="buyPlatformId" value={buyPlatformId} />
      <input type="hidden" name="sellPlatformId" value={withSell ? sellPlatformId : ""} />

      {!deal && (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={withSell ? "outline" : "default"}
            onClick={() => setWithSell(false)}
          >
            Купил
          </Button>
          <Button
            type="button"
            variant={withSell ? "default" : "outline"}
            onClick={() => setWithSell(true)}
          >
            Купил и продал
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px_80px]">
        <div className="grid gap-1.5">
          <Label htmlFor="itemName">Скин</Label>
          <Input
            id="itemName"
            name="itemName"
            list="item-name-suggestions"
            placeholder="AK-47 | Redline"
            defaultValue={deal?.itemName ?? ""}
            required
          />
          <datalist id="item-name-suggestions">
            {itemNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="itemQuality">Качество</Label>
          <Input
            id="itemQuality"
            name="itemQuality"
            list="quality-suggestions"
            placeholder="Field-Tested"
            defaultValue={deal?.itemQuality ?? ""}
          />
          <datalist id="quality-suggestions">
            {QUALITIES.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="quantity">Кол-во</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
      </div>

      <fieldset className="rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Покупка</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 grid gap-1.5">
            <Label>Площадка</Label>
            <NativeSelect
              value={buyPlatformId}
              onChange={(e) => onBuyPlatformChange(e.target.value)}
              required
            >
              <option value="" disabled>
                Выберите площадку
              </option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="buyPrice">Цена за шт.</Label>
            <Input
              id="buyPrice"
              name="buyPrice"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Валюта</Label>
            <NativeSelect
              name="buyCurrency"
              value={buyCurrency}
              onChange={(e) => setBuyCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="buyFeePct">Комиссия, %</Label>
            <Input
              id="buyFeePct"
              name="buyFeePct"
              type="number"
              min={0}
              max={100}
              step="any"
              inputMode="decimal"
              value={buyFeePct}
              onChange={(e) => setBuyFeePct(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="buyFxRate">Курс к {baseCurrency}</Label>
            <Input
              id="buyFxRate"
              name="buyFxRate"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={buyCurrency === baseCurrency ? "1" : buyFxRate}
              onChange={(e) => setBuyFxRate(e.target.value)}
              disabled={buyCurrency === baseCurrency}
            />
            {buyCurrency === baseCurrency && (
              <input type="hidden" name="buyFxRate" value="1" />
            )}
          </div>
          <div className="col-span-2 grid gap-1.5">
            <Label htmlFor="buyDate">Дата покупки</Label>
            <Input
              id="buyDate"
              name="buyDate"
              type="date"
              defaultValue={deal?.buyDate ?? today()}
              required
            />
          </div>
        </div>
      </fieldset>

      {deal && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withSell}
            onChange={(e) => setWithSell(e.target.checked)}
          />
          Продано (заполнить блок продажи)
        </label>
      )}

      {withSell && (
        <fieldset className="rounded-lg border p-3">
          <legend className="px-1 text-sm font-medium">
            {status === "withdrawn_via_skin" ? "Вывод" : "Продажа"}
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="col-span-2 grid gap-1.5">
              <Label>Площадка</Label>
              <NativeSelect
                value={sellPlatformId}
                onChange={(e) => onSellPlatformChange(e.target.value)}
                required={withSell}
              >
                <option value="" disabled>
                  Выберите площадку
                </option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sellPrice">Цена за шт.</Label>
              <Input
                id="sellPrice"
                name="sellPrice"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                required={withSell}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Валюта</Label>
              <NativeSelect
                name="sellCurrency"
                value={sellCurrency}
                onChange={(e) => setSellCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sellFeePct">Комиссия, %</Label>
              <Input
                id="sellFeePct"
                name="sellFeePct"
                type="number"
                min={0}
                max={100}
                step="any"
                inputMode="decimal"
                value={sellFeePct}
                onChange={(e) => setSellFeePct(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sellFxRate">Курс к {baseCurrency}</Label>
              <Input
                id="sellFxRate"
                name="sellFxRate"
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                value={sellCurrency === baseCurrency ? "1" : sellFxRate}
                onChange={(e) => setSellFxRate(e.target.value)}
                disabled={sellCurrency === baseCurrency}
              />
              {sellCurrency === baseCurrency && (
                <input type="hidden" name="sellFxRate" value="1" />
              )}
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="sellDate">
                {status === "withdrawn_via_skin" ? "Дата вывода" : "Дата продажи"}
              </Label>
              <Input
                id="sellDate"
                name="sellDate"
                type="date"
                defaultValue={deal?.sellDate ?? today()}
                required={withSell}
              />
            </div>
          </div>
        </fieldset>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="note">Комментарий</Label>
        <Textarea
          id="note"
          name="note"
          rows={2}
          placeholder="Необязательно"
          defaultValue={deal?.note ?? ""}
        />
      </div>

      <div className="rounded-lg bg-muted px-3 py-2 text-sm">
        {calc == null ? (
          <span className="text-muted-foreground">
            Заполните цену покупки — расчёт появится здесь
          </span>
        ) : calc.profit == null ? (
          <span>
            Затраты на покупку:{" "}
            <b>{formatMoney(calc.cost, baseCurrency)}</b>
          </span>
        ) : (
          <span
            className={
              calc.profit >= 0 ? "text-emerald-600" : "text-red-600"
            }
          >
            Прибыль: <b>{formatMoney(calc.profit, baseCurrency, true)}</b>
            {calc.margin != null && <> · маржа {formatPct(calc.margin)}</>}
          </span>
        )}
      </div>

      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Сохранение…" : deal ? "Сохранить" : "Добавить сделку"}
        </Button>
      </div>
    </form>
  );
}
