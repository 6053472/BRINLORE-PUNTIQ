-- ---------- Uitgestelde controle van beschermende foreign keys ----------
-- Deze FK's (ON DELETE NO ACTION) voorkomen dat je bijvoorbeeld een woning met contracten of een
-- gefactureerde huurder verwijdert. Bij het verwijderen van een heel bedrijf lopen er echter meerdere
-- cascadepaden tegelijk; zonder DEFERRABLE kan de controle afgaan voordat het andere pad klaar is.
-- INITIALLY DEFERRED controleert pas bij COMMIT: losse verwijderingen blijven geblokkeerd.
ALTER TABLE "units" ALTER CONSTRAINT "units_company_id_building_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "contracts" ALTER CONSTRAINT "contracts_company_id_unit_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "contract_tenants" ALTER CONSTRAINT "contract_tenants_company_id_tenant_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "maintenance_requests" ALTER CONSTRAINT "maintenance_requests_building_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "maintenance_requests" ALTER CONSTRAINT "maintenance_requests_unit_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "invoices" ALTER CONSTRAINT "invoices_contract_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "invoices" ALTER CONSTRAINT "invoices_tenant_id_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "payment_allocations" ALTER CONSTRAINT "payment_allocations_invoice_id_fkey" DEFERRABLE INITIALLY DEFERRED;
