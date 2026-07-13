import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import {
  BuildableUnit,
  BuildMenus,
  Gold,
  PlayerBuildableUnitType,
  UnitType,
} from "../../../core/game/Game";
import { UserSettings } from "../../../core/game/UserSettings";
import { Controller } from "../../Controller";
import { ToggleStructureEvent } from "../../InputHandler";
import { UIState } from "../../UIState";
import { renderNumber, translateText } from "../../Utils";
import { GameView } from "../../view";
const warshipIcon = assetUrl("images/BattleshipIconWhite.svg");
const cityIcon = assetUrl("images/CityIconWhite.svg");
const factoryIcon = assetUrl("images/FactoryIconWhite.svg");
const goldCoinIcon = assetUrl("images/GoldCoinIcon.svg");
const mirvIcon = assetUrl("images/MIRVIcon.svg");
const missileSiloIcon = assetUrl("images/MissileSiloIconWhite.svg");
const hydrogenBombIcon = assetUrl("images/MushroomCloudIconWhite.svg");
const atomBombIcon = assetUrl("images/NukeIconWhite.svg");
const portIcon = assetUrl("images/PortIcon.svg");
const samLauncherIcon = assetUrl("images/SamLauncherIconWhite.svg");
const defensePostIcon = assetUrl("images/ShieldIconWhite.svg");
const submarineIcon = assetUrl("images/SubmarineIconWhite.svg");
const aircraftCarrierIcon = assetUrl("images/AircraftCarrierIconWhite.svg");
const antiAirFrigateIcon = assetUrl("images/AntiAirFrigateIconWhite.svg");
const navalMineIcon = assetUrl("images/NavalMineIconWhite.svg");
const congressIcon = assetUrl("images/CongressIconWhite.svg");

function translateWithFallback(key: string, fallback: string): string {
  const translated = translateText(key);
  return translated === key ? fallback : translated;
}

@customElement("unit-display")
export class UnitDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;
  public uiState: UIState;
  private playerBuildables: BuildableUnit[] | null = null;
  private keybinds: Record<string, { value: string; key: string }> = {};
  private _cities = 0;
  private _warships = 0;
  private _factories = 0;
  private _missileSilo = 0;
  private _port = 0;
  private _defensePost = 0;
  private _samLauncher = 0;
  private _submarines = 0;
  private _carriers = 0;
  private _antiAirFrigates = 0;
  private _navalMines = 0;
  private _congresses = 0;
  private allDisabled = false;
  private _hoveredUnit: PlayerBuildableUnitType | null = null;

  createRenderRoot() {
    return this;
  }

  init() {
    const config = this.game.config();
    const userSettings = new UserSettings();

    this.keybinds = userSettings.parsedUserKeybinds();

    this.allDisabled = BuildMenus.types.every((u) => config.isUnitDisabled(u));
    this.requestUpdate();
  }

  private cost(item: UnitType): Gold {
    for (const bu of this.playerBuildables ?? []) {
      if (bu.type === item) {
        return bu.cost;
      }
    }
    return 0n;
  }

  private canBuild(item: UnitType): boolean {
    if (this.game?.config().isUnitDisabled(item)) return false;
    const player = this.game?.myPlayer();
    switch (item) {
      case UnitType.AtomBomb:
      case UnitType.HydrogenBomb:
      case UnitType.MIRV:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.MissileSilo).length ?? 0) > 0
        );
      case UnitType.Warship:
      case UnitType.Submarine:
      case UnitType.AircraftCarrier:
      case UnitType.AntiAirFrigate:
      case UnitType.NavalMine:
        return (
          this.cost(item) <= (player?.gold() ?? 0n) &&
          (player?.units(UnitType.Port).length ?? 0) > 0
        );
      default:
        return this.cost(item) <= (player?.gold() ?? 0n);
    }
  }

  tick() {
    const player = this.game?.myPlayer();
    if (!player) return;
    player.buildables(undefined, BuildMenus.types).then((buildables) => {
      this.playerBuildables = buildables;
    });
    this._cities = player.totalUnitLevels(UnitType.City);
    this._missileSilo = player.totalUnitLevels(UnitType.MissileSilo);
    this._port = player.totalUnitLevels(UnitType.Port);
    this._defensePost = player.totalUnitLevels(UnitType.DefensePost);
    this._samLauncher = player.totalUnitLevels(UnitType.SAMLauncher);
    this._factories = player.totalUnitLevels(UnitType.Factory);
    this._warships = player.totalUnitLevels(UnitType.Warship);
    this._submarines = player.totalUnitLevels(UnitType.Submarine);
    this._carriers = player.totalUnitLevels(UnitType.AircraftCarrier);
    this._antiAirFrigates = player.totalUnitLevels(UnitType.AntiAirFrigate);
    this._navalMines = player.totalUnitLevels(UnitType.NavalMine);
    this._congresses = player.totalUnitLevels(UnitType.Congress);
    this.requestUpdate();
  }

  render() {
    const myPlayer = this.game?.myPlayer();
    if (
      !this.game ||
      !myPlayer ||
      this.game.inSpawnPhase() ||
      !myPlayer.isAlive()
    ) {
      return null;
    }
    if (this.allDisabled) {
      return null;
    }

    return html`
      <div class="border-t border-white/10 p-0.5 w-full">
        <div class="flex items-center justify-center gap-2 w-fit mx-auto">
          <div
            data-unit-group="structures"
            class="grid grid-rows-1 auto-cols-max grid-flow-col gap-0.5"
          >
            ${this.renderUnitItem(
              cityIcon,
              this._cities,
              UnitType.City,
              "city",
              this.keybinds["buildCity"]?.key ?? "1",
            )}
            ${this.renderUnitItem(
              factoryIcon,
              this._factories,
              UnitType.Factory,
              "factory",
              this.keybinds["buildFactory"]?.key ?? "2",
            )}
            ${this.renderUnitItem(
              portIcon,
              this._port,
              UnitType.Port,
              "port",
              this.keybinds["buildPort"]?.key ?? "3",
            )}
            ${this.renderUnitItem(
              congressIcon,
              this._congresses,
              UnitType.Congress,
              "congress",
              this.keybinds["buildCongress"]?.key ?? "4",
            )}
            ${this.renderUnitItem(
              defensePostIcon,
              this._defensePost,
              UnitType.DefensePost,
              "defense_post",
              this.keybinds["buildDefensePost"]?.key ?? "",
            )}
            ${this.renderUnitItem(
              missileSiloIcon,
              this._missileSilo,
              UnitType.MissileSilo,
              "missile_silo",
              this.keybinds["buildMissileSilo"]?.key ?? "",
            )}
            ${this.renderUnitItem(
              samLauncherIcon,
              this._samLauncher,
              UnitType.SAMLauncher,
              "sam_launcher",
              this.keybinds["buildSamLauncher"]?.key ?? "",
            )}
          </div>
          <div class="h-6 w-px bg-slate-500/70" aria-hidden="true"></div>
          <div
            data-unit-group="vehicles"
            class="grid grid-rows-1 auto-cols-max grid-flow-col gap-0.5"
          >
            ${this.renderUnitItem(
              submarineIcon,
              this._submarines,
              UnitType.Submarine,
              "submarine",
              this.keybinds["buildSubmarine"]?.key ?? "5",
            )}
            ${this.renderUnitItem(
              aircraftCarrierIcon,
              this._carriers,
              UnitType.AircraftCarrier,
              "aircraft_carrier",
              this.keybinds["buildAircraftCarrier"]?.key ?? "6",
            )}
            ${this.renderUnitItem(
              warshipIcon,
              this._warships,
              UnitType.Warship,
              "warship",
              this.keybinds["buildWarship"]?.key ?? "7",
            )}
            ${this.renderUnitItem(
              antiAirFrigateIcon,
              this._antiAirFrigates,
              UnitType.AntiAirFrigate,
              "anti_air_frigate",
              this.keybinds["buildAntiAirFrigate"]?.key ?? "8",
            )}
            ${this.renderUnitItem(
              navalMineIcon,
              this._navalMines,
              UnitType.NavalMine,
              "naval_mine",
              this.keybinds["buildNavalMine"]?.key ?? "9",
            )}
            ${this.renderUnitItem(
              atomBombIcon,
              null,
              UnitType.AtomBomb,
              "atom_bomb",
              this.keybinds["buildAtomBomb"]?.key ?? "Shift+8",
            )}
            ${this.renderUnitItem(
              hydrogenBombIcon,
              null,
              UnitType.HydrogenBomb,
              "hydrogen_bomb",
              this.keybinds["buildHydrogenBomb"]?.key ?? "Shift+9",
            )}
            ${this.renderUnitItem(
              mirvIcon,
              null,
              UnitType.MIRV,
              "mirv",
              this.keybinds["buildMIRV"]?.key ?? "Shift+0",
            )}
          </div>
        </div>
        ${this.renderMaritimeObjectiveSummary()}
        ${this.renderTradeRouteSummary()}
      </div>
    `;
  }

  private renderMaritimeObjectiveSummary() {
    const objective = this.game?.frameData?.().maritimeObjective;
    if (objective === undefined || objective === null) {
      return null;
    }

    const statusLabel =
      objective.status === "contested"
        ? translateWithFallback("maritime_objective.contested", "Contested")
        : objective.status === "controlled"
          ? translateWithFallback("maritime_objective.controlled", "Controlled")
          : objective.status === "capturing"
            ? translateWithFallback("maritime_objective.capturing", "Capturing")
            : translateWithFallback("maritime_objective.neutral", "Neutral");

    const statusClass =
      objective.status === "contested"
        ? "text-amber-300"
        : objective.status === "controlled"
          ? "text-emerald-300"
          : objective.status === "capturing"
            ? "text-cyan-200"
            : "text-slate-400";
    const progressText = `${Math.round(objective.controlPercent)}%`;
    const fleetLabel = objective.leaderTeam ?? objective.controllerTeam;
    const fleetText =
      fleetLabel !== null && fleetLabel !== undefined
        ? `${fleetLabel} Fleet`
        : null;

    return html`
      <div
        class="mt-0.5 text-[10px] text-cyan-100 text-center leading-none"
        title=${translateWithFallback(
          "maritime_objective.hint",
          "Control the central sea route to win",
        )}
      >
        <span class="text-slate-300">
          ${translateWithFallback(
            "maritime_objective.hint",
            "Control the central sea route to win",
          )}
        </span>
        <span class="text-white"> · ${objective.name}</span>
        ${fleetText !== null
          ? html`<span class="text-cyan-100"> · ${fleetText}</span>`
          : null}
        <span class=${statusClass}> · ${statusLabel}: ${progressText} </span>
      </div>
    `;
  }

  private renderTradeRouteSummary() {
    const routes = this.game?.frameData?.().tradeRoutes ?? [];
    const ownRoutes = routes.filter((route) => route.relation === "own");
    if (ownRoutes.length === 0) {
      return null;
    }
    const riskyRoutes = ownRoutes.filter(
      (route) => route.riskLevel !== "safe",
    ).length;
    const contestedRoutes = ownRoutes.filter(
      (route) => route.riskLevel === "contested",
    ).length;
    const dangerousRoutes = ownRoutes.filter(
      (route) => route.riskLevel === "dangerous",
    ).length;
    const escortCount = ownRoutes.reduce(
      (total, route) => total + route.escortCount,
      0,
    );
    const estimatedGold = ownRoutes.reduce(
      (total, route) => total + (route.estimatedGold ?? 0),
      0,
    );

    return html`
      <div
        class="mt-0.5 text-[10px] text-cyan-200 text-center leading-none"
        title=${translateWithFallback(
          "trade_routes.summary_title",
          "Active merchant routes, contested sea lanes, and naval escorts",
        )}
      >
        ${translateWithFallback("trade_routes.routes", "Routes")}:
        ${ownRoutes.length}
        <span class=${riskyRoutes > 0 ? "text-amber-300" : "text-slate-400"}>
          · ${translateWithFallback("trade_routes.risk", "Risk")}:
          ${riskyRoutes}
        </span>
        ${estimatedGold > 0
          ? html`<span class="text-yellow-300">
              · ${translateWithFallback("trade_routes.value", "Value")}:
              ${renderNumber(estimatedGold)}
            </span>`
          : null}
        ${contestedRoutes > 0
          ? html`<span class="text-amber-200">
              · ${translateWithFallback("trade_routes.contested", "Contested")}:
              ${contestedRoutes}
            </span>`
          : null}
        ${dangerousRoutes > 0
          ? html`<span class="text-red-300">
              · ${translateWithFallback("trade_routes.danger", "Danger")}:
              ${dangerousRoutes}
            </span>`
          : null}
        ${escortCount > 0
          ? html`<span class="text-emerald-300">
              · ${translateWithFallback("trade_routes.escorts", "Escorts")}:
              ${escortCount}
            </span>`
          : null}
      </div>
    `;
  }

  private renderUnitItem(
    icon: string,
    number: number | null,
    unitType: PlayerBuildableUnitType,
    structureKey: string,
    hotkey: string,
  ) {
    if (this.game.config().isUnitDisabled(unitType)) {
      return html``;
    }
    const selected = this.uiState.ghostStructure === unitType;
    const hovered = this._hoveredUnit === unitType;
    const displayHotkey = hotkey
      .replace("Digit", "")
      .replace("Key", "")
      .toUpperCase();

    return html`
      <div
        class="flex flex-col items-center relative"
        @mouseenter=${() => {
          this._hoveredUnit = unitType;
          this.requestUpdate();
        }}
        @mouseleave=${() => {
          this._hoveredUnit = null;
          this.requestUpdate();
        }}
      >
        ${hovered
          ? html`
              <div
                class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-gray-200 text-center w-max text-xs bg-gray-800/90 backdrop-blur-xs rounded-sm p-1 z-[100] shadow-lg pointer-events-none"
              >
                <div class="font-bold text-sm mb-1">
                  ${translateText(
                    "unit_type." + structureKey,
                  )}${` [${displayHotkey}]`}
                </div>
                <div class="p-2">
                  ${translateText("build_menu.desc." + structureKey)}
                </div>
                ${unitType === UnitType.Warship
                  ? html`<div
                      class="mt-1 px-2 py-1 text-[10px] text-cyan-300 border-t border-white/10"
                    >
                      ⇧ ${translateText("build_menu.warship_shift_hint")}
                    </div>`
                  : null}
                <div class="flex items-center justify-center gap-1">
                  <img src=${goldCoinIcon} width="13" height="13" />
                  <span class="text-yellow-300"
                    >${renderNumber(this.cost(unitType))}</span
                  >
                </div>
              </div>
            `
          : null}
        <div
          class="${this.canBuild(unitType)
            ? ""
            : "opacity-40"} border border-slate-500 rounded-sm px-0.5 pb-0.5 flex items-center gap-0.5 cursor-pointer
             ${selected ? "hover:bg-gray-400/10" : "hover:bg-gray-800"}
             rounded-sm text-white ${selected ? "bg-slate-400/20" : ""}"
          @click=${() => {
            if (selected) {
              this.uiState.ghostStructure = null;
            } else if (this.canBuild(unitType)) {
              this.uiState.ghostStructure = unitType;
            }
            this.requestUpdate();
          }}
          @mouseenter=${() => {
            switch (unitType) {
              case UnitType.AtomBomb:
              case UnitType.HydrogenBomb:
                this.eventBus?.emit(
                  new ToggleStructureEvent([
                    UnitType.MissileSilo,
                    UnitType.SAMLauncher,
                  ]),
                );
                break;
              case UnitType.Warship:
              case UnitType.Submarine:
              case UnitType.AircraftCarrier:
              case UnitType.AntiAirFrigate:
              case UnitType.NavalMine:
                this.eventBus?.emit(new ToggleStructureEvent([UnitType.Port]));
                break;
              default:
                this.eventBus?.emit(new ToggleStructureEvent([unitType]));
            }
          }}
          @mouseleave=${() =>
            this.eventBus?.emit(new ToggleStructureEvent(null))}
        >
          ${html`<div class="ml-0.5 text-[10px] relative -top-1 text-gray-400">
            ${displayHotkey}
          </div>`}
          <div class="flex items-center gap-0.5 pt-0.5">
            <img src=${icon} alt=${structureKey} class="align-middle size-5" />
            ${number !== null
              ? html`<span class="text-xs">${renderNumber(number)}</span>`
              : null}
          </div>
        </div>
      </div>
    `;
  }
}
