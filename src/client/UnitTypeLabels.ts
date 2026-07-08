import {
  DISABLED_ARSENAL,
  UnitType,
  type PlayerBuildableUnitType,
} from "../core/game/Game";

export const ALL_UNIT_OPTIONS: {
  type: PlayerBuildableUnitType;
  translationKey: string;
}[] = [
  { type: UnitType.City, translationKey: "unit_type.city" },
  { type: UnitType.DefensePost, translationKey: "unit_type.defense_post" },
  { type: UnitType.Port, translationKey: "unit_type.port" },
  { type: UnitType.Warship, translationKey: "unit_type.warship" },
  { type: UnitType.Submarine, translationKey: "unit_type.submarine" },
  {
    type: UnitType.AircraftCarrier,
    translationKey: "unit_type.aircraft_carrier",
  },
  { type: UnitType.NavalMine, translationKey: "unit_type.naval_mine" },
  { type: UnitType.TransportShip, translationKey: "unit_type.boat" },
  { type: UnitType.MissileSilo, translationKey: "unit_type.missile_silo" },
  { type: UnitType.SAMLauncher, translationKey: "unit_type.sam_launcher" },
  { type: UnitType.AtomBomb, translationKey: "unit_type.atom_bomb" },
  { type: UnitType.HydrogenBomb, translationKey: "unit_type.hydrogen_bomb" },
  { type: UnitType.MIRV, translationKey: "unit_type.mirv" },
  { type: UnitType.Factory, translationKey: "unit_type.factory" },
];

export const UNIT_TYPE_TRANSLATION_KEYS: Readonly<
  Partial<Record<UnitType, string>>
> = Object.freeze({
  ...Object.fromEntries(
    ALL_UNIT_OPTIONS.map((option) => [option.type, option.translationKey]),
  ),
  [UnitType.TradeShip]: "player_stats_table.unit.trade",
  [UnitType.MIRVWarhead]: "player_stats_table.unit.mirvw",
});

// naval-trim: the arsenal is a config-locked floor (DISABLED_ARSENAL) that
// can never be re-enabled, so its toggles are pruned from the UI entirely
// rather than shown disabled. Deriving this filter from DISABLED_ARSENAL
// keeps the UI in sync automatically if the arsenal list ever changes.
export const unitOptions = ALL_UNIT_OPTIONS.filter(
  (option) => !DISABLED_ARSENAL.includes(option.type),
);
