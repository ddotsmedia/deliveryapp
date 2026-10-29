import { Module, type DynamicModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./common/auth.guard.js";
import { ProblemFilter } from "./common/problem.filter.js";
import { InfraModule, type Resources } from "./infra/providers.js";
import { HealthModule } from "./modules/health/health.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { CommerceModule } from "./modules/commerce/commerce.module.js";

@Module({})
export class AppModule {
  static register(r: Resources): DynamicModule {
    return {
      module: AppModule,
      imports: [InfraModule.forRoot(r), HealthModule, IdentityModule, CatalogModule, CommerceModule],
      providers: [
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_FILTER, useClass: ProblemFilter },
      ],
    };
  }
}
