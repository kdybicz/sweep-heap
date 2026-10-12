export class HouseholdMutationBusyError extends Error {
  constructor() {
    super("Household is busy. Please retry.");
    this.name = "HouseholdMutationBusyError";
  }
}
