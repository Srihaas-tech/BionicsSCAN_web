"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  Barcode,
  Boxes,
  CircleCheck,
  PackageSearch,
  RefreshCw,
  ScanLine,
  TriangleAlert,
} from "lucide-react";

import type {
  InventoryItem,
  InventoryType,
  SyncStatus,
} from "@/src/types/inventory";
import { INVENTORY_TYPES } from "@/src/types/inventory";
import {
  formatItemSize,
  getStockState,
  INVENTORY_META,
} from "@/src/lib/inventory";

interface InventoryDashboardProps {
  initialItems: InventoryItem[];
  databaseError: boolean;
}

const POLL_INTERVAL_MS = 2_000;

export function InventoryDashboard({
  initialItems,
  databaseError,
}: InventoryDashboardProps) {
  const [items, setItems] = useState(initialItems);

  const [selectedType, setSelectedType] =
    useState<InventoryType>("BELT_9MM");

  const [query, setQuery] = useState("");

  const [syncStatus, setSyncStatus] =
    useState<SyncStatus>(
      databaseError ? "offline" : "online",
    );

  const [message, setMessage] =
    useState<string | null>(
      databaseError
        ? "Database connection failed."
        : null,
    );

  const [lastRefresh, setLastRefresh] =
    useState<Date | null>(null);

  const refreshInFlightRef = useRef(false);

  const refreshItems = useCallback(
    async (
      type: InventoryType,
      quiet = false,
    ) => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      if (!quiet) {
        setSyncStatus("syncing");
      }

      try {
        const response = await fetch(
          `/api/items?type=${encodeURIComponent(type)}`,
          {
            cache: "no-store",
          },
        );

        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "Inventory refresh failed.",
          );
        }

        const data = (await response.json()) as {
          items: InventoryItem[];
        };

        setItems((currentItems) => {
          const otherTypes = currentItems.filter(
            (item) =>
              item.inventoryType !== type,
          );

          return [
            ...otherTypes,
            ...data.items,
          ];
        });

        setSyncStatus("online");
        setMessage(null);
        setLastRefresh(new Date());
      } catch (error) {
        console.error(
          `Inventory refresh failed for ${type}`,
          error,
        );

        setSyncStatus("offline");

        setMessage(
          "The inventory could not refresh. Existing data remains visible.",
        );
      } finally {
        refreshInFlightRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    setLastRefresh(new Date());

    if (databaseError) {
      return;
    }

    void refreshItems(
      selectedType,
      true,
    );
  }, [
    databaseError,
    refreshItems,
    selectedType,
  ]);

  useEffect(() => {
    if (databaseError) {
      return;
    }

    const timer = window.setInterval(() => {
      if (
        document.visibilityState !== "visible"
      ) {
        return;
      }

      void refreshItems(
        selectedType,
        true,
      );
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    databaseError,
    refreshItems,
    selectedType,
  ]);

  useEffect(() => {
    if (databaseError) {
      return;
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState === "visible"
      ) {
        void refreshItems(
          selectedType,
          true,
        );
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [
    databaseError,
    refreshItems,
    selectedType,
  ]);

  const categoryItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.inventoryType === selectedType,
      ),
    [
      items,
      selectedType,
    ],
  );

  const visibleItems = useMemo(() => {
    const normalized =
      query.trim().toUpperCase();

    if (!normalized) {
      return categoryItems;
    }

    return categoryItems.filter(
      (item) =>
        item.barcode.includes(normalized) ||
        String(item.size).includes(
          normalized,
        ),
    );
  }, [
    categoryItems,
    query,
  ]);

  const totalUnits =
    categoryItems.reduce(
      (sum, item) =>
        sum + item.quantity,
      0,
    );

  const lowStock =
    categoryItems.filter(
      (item) =>
        item.quantity > 0 &&
        item.quantity <= 2,
    ).length;

  const outOfStock =
    categoryItems.filter(
      (item) =>
        item.quantity === 0,
    ).length;

  const statusText =
    syncStatus === "online"
      ? "Database online"
      : syncStatus === "syncing"
        ? "Refreshing"
        : "Offline";

  return (
    <main
      className="page-shell"
      id="main-content"
    >
      <section className="page-heading inventory-heading">
        <div>
          <div className="eyebrow">
            Bionics 4909
          </div>

          <h1>FRC inventory</h1>

          <p>
            Track belts, gears, and
            sprockets from any phone or
            computer.
          </p>
        </div>

        <div className="heading-actions no-print">
          <Link
            className="button button-secondary"
            href="/labels"
          >
            <Barcode
              size={18}
              aria-hidden="true"
            />
            Labels
          </Link>

          <Link
            className="button button-primary"
            href="/scan"
          >
            <ScanLine
              size={18}
              aria-hidden="true"
            />
            Scan
          </Link>
        </div>
      </section>

      <div
        className={`connection-banner ${syncStatus}`}
        role="status"
      >
        {syncStatus === "online" ? (
          <CircleCheck size={18} />
        ) : syncStatus === "syncing" ? (
          <RefreshCw
            className="spin"
            size={18}
          />
        ) : (
          <AlertCircle size={18} />
        )}

        <strong>
          {statusText}
        </strong>

        <span>
          {lastRefresh
            ? `Last checked ${lastRefresh.toLocaleTimeString(
                [],
                {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                },
              )}`
            : "Checking connection"}
        </span>

        <button
          className="text-button"
          type="button"
          onClick={() =>
            void refreshItems(
              selectedType,
            )
          }
          disabled={
            syncStatus === "syncing"
          }
        >
          Refresh now
        </button>
      </div>

      {message ? (
        <div className="alert alert-warning">
          <TriangleAlert size={18} />

          <span>
            {message}
          </span>
        </div>
      ) : null}

      <section
        className="summary-grid"
        aria-label="Inventory summary"
      >
        <article className="summary-card">
          <Boxes aria-hidden="true" />

          <span>
            Sizes
          </span>

          <strong>
            {categoryItems.length}
          </strong>
        </article>

        <article className="summary-card">
          <PackageSearch aria-hidden="true" />

          <span>
            Total units
          </span>

          <strong>
            {totalUnits}
          </strong>
        </article>

        <article className="summary-card warning">
          <TriangleAlert aria-hidden="true" />

          <span>
            Low stock
          </span>

          <strong>
            {lowStock}
          </strong>
        </article>

        <article className="summary-card danger">
          <AlertCircle aria-hidden="true" />

          <span>
            Out of stock
          </span>

          <strong>
            {outOfStock}
          </strong>
        </article>
      </section>

      <section className="inventory-panel">
        <div
          className="category-tabs"
          role="tablist"
          aria-label="Inventory categories"
        >
          {INVENTORY_TYPES.map(
            (type) => (
              <button
                className={
                  selectedType === type
                    ? "category-tab active"
                    : "category-tab"
                }
                key={type}
                type="button"
                role="tab"
                aria-selected={
                  selectedType === type
                }
                onClick={() =>
                  setSelectedType(type)
                }
              >
                {
                  INVENTORY_META[
                    type
                  ].label
                }

                <span>
                  {
                    items.filter(
                      (item) =>
                        item.inventoryType ===
                        type,
                    ).length
                  }
                </span>
              </button>
            ),
          )}
        </div>

        <div className="inventory-toolbar">
          <div>
            <h2>
              {
                INVENTORY_META[
                  selectedType
                ].label
              }
            </h2>

            <p>
              Select an item to check
              inventory in or out.
            </p>
          </div>

          <label className="search-field">
            <PackageSearch
              size={18}
              aria-hidden="true"
            />

            <span className="sr-only">
              Search inventory
            </span>

            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Search size or barcode"
            />
          </label>
        </div>

        {databaseError &&
        items.length === 0 ? (
          <div className="setup-card">
            <AlertCircle
              size={36}
              aria-hidden="true"
            />

            <h3>
              Connect the database
            </h3>

            <p>
              Add{" "}
              <code>
                DATABASE_URL
              </code>
              , then run the included
              database setup.
            </p>
          </div>
        ) : visibleItems.length ===
          0 ? (
          <div className="setup-card">
            <PackageSearch
              size={36}
              aria-hidden="true"
            />

            <h3>
              No matching items
            </h3>

            <p>
              Change the search value or
              select another category.
            </p>
          </div>
        ) : (
          <div className="inventory-grid">
            {visibleItems.map(
              (item) => {
                const stock =
                  getStockState(
                    item.quantity,
                  );

                return (
                  <Link
                    className="inventory-card"
                    href={`/inventory/${item.id}`}
                    key={item.id}
                  >
                    <div className="inventory-card-top">
                      <span className="item-size">
                        {formatItemSize(
                          item.inventoryType,
                          item.size,
                        )}
                      </span>

                      <span
                        className={`stock-badge ${stock.tone}`}
                      >
                        {stock.label}
                      </span>
                    </div>

                    <span className="item-type">
                      {
                        INVENTORY_META[
                          item
                            .inventoryType
                        ].singular
                      }
                    </span>

                    <code>
                      {item.barcode}
                    </code>

                    <div className="quantity-display">
                      <span>
                        Quantity
                      </span>

                      <strong>
                        {item.quantity}
                      </strong>
                    </div>
                  </Link>
                );
              },
            )}
          </div>
        )}
      </section>
    </main>
  );
}