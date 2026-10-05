package com.dsbuilder.ds.components.di

import com.dsbuilder.ds.components.application.ComponentConfigRepository
import com.dsbuilder.ds.components.application.ComponentDependencyRepository
import com.dsbuilder.ds.components.application.ComponentRepository
import com.dsbuilder.ds.components.application.ComponentReuseConfigRepository
import com.dsbuilder.ds.components.application.CreateComponentDependencyUseCase
import com.dsbuilder.ds.components.application.CreateComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.CreateComponentUseCase
import com.dsbuilder.ds.components.application.CreateDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.DeleteComponentDependencyUseCase
import com.dsbuilder.ds.components.application.DeleteComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.DeleteComponentUseCase
import com.dsbuilder.ds.components.application.DeleteDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.DesignSystemComponentRepository
import com.dsbuilder.ds.components.application.ExportComponentConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentDependencyUseCase
import com.dsbuilder.ds.components.application.GetComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.GetComponentUseCase
import com.dsbuilder.ds.components.application.GetDesignSystemComponentUseCase
import com.dsbuilder.ds.components.application.ImportComponentConfigUseCase
import com.dsbuilder.ds.components.application.ListComponentDependenciesUseCase
import com.dsbuilder.ds.components.application.ListComponentPropertiesUseCase
import com.dsbuilder.ds.components.application.ListComponentReuseConfigsByDependencyUseCase
import com.dsbuilder.ds.components.application.ListComponentReuseConfigsUseCase
import com.dsbuilder.ds.components.application.ListComponentVariationsUseCase
import com.dsbuilder.ds.components.application.ListComponentsUseCase
import com.dsbuilder.ds.components.application.ListDependenciesByComponentUseCase
import com.dsbuilder.ds.components.application.ListDesignSystemComponentsUseCase
import com.dsbuilder.ds.components.application.UpdateComponentDependencyUseCase
import com.dsbuilder.ds.components.application.UpdateComponentReuseConfigUseCase
import com.dsbuilder.ds.components.application.UpdateComponentUseCase
import com.dsbuilder.ds.components.data.ExposedComponentConfigRepository
import com.dsbuilder.ds.components.data.ExposedComponentDependencyRepository
import com.dsbuilder.ds.components.data.ExposedComponentRepository
import com.dsbuilder.ds.components.data.ExposedComponentReuseConfigRepository
import com.dsbuilder.ds.components.data.ExposedDesignSystemComponentRepository
import org.koin.dsl.module

/** Dependency bindings owned by the component feature. */
val componentsModule = module {
    single<ComponentRepository> { ExposedComponentRepository() }
    single<ComponentConfigRepository> { ExposedComponentConfigRepository() }
    single<DesignSystemComponentRepository> { ExposedDesignSystemComponentRepository() }
    single<ComponentDependencyRepository> { ExposedComponentDependencyRepository() }
    single<ComponentReuseConfigRepository> { ExposedComponentReuseConfigRepository() }
    factory { ListComponentsUseCase(get(), get(), get()) }
    factory { GetComponentUseCase(get(), get(), get()) }
    factory { CreateComponentUseCase(get(), get(), get()) }
    factory { UpdateComponentUseCase(get(), get(), get()) }
    factory { DeleteComponentUseCase(get(), get(), get()) }
    factory { ListComponentVariationsUseCase(get(), get(), get()) }
    factory { ListComponentPropertiesUseCase(get(), get(), get()) }
    factory { ListDependenciesByComponentUseCase(get(), get(), get()) }
    factory { ListDesignSystemComponentsUseCase(get(), get(), get()) }
    factory { GetDesignSystemComponentUseCase(get(), get(), get()) }
    factory { CreateDesignSystemComponentUseCase(get(), get(), get()) }
    factory { DeleteDesignSystemComponentUseCase(get(), get(), get()) }
    factory { ListComponentDependenciesUseCase(get(), get(), get()) }
    factory { GetComponentDependencyUseCase(get(), get(), get()) }
    factory { CreateComponentDependencyUseCase(get(), get(), get()) }
    factory { UpdateComponentDependencyUseCase(get(), get(), get()) }
    factory { DeleteComponentDependencyUseCase(get(), get(), get()) }
    factory { ListComponentReuseConfigsUseCase(get(), get(), get()) }
    factory { GetComponentReuseConfigUseCase(get(), get(), get()) }
    factory { ListComponentReuseConfigsByDependencyUseCase(get(), get(), get()) }
    factory { CreateComponentReuseConfigUseCase(get(), get(), get()) }
    factory { UpdateComponentReuseConfigUseCase(get(), get(), get()) }
    factory { DeleteComponentReuseConfigUseCase(get(), get(), get()) }
    factory { GetComponentConfigUseCase(get(), get(), get()) }
    factory { ExportComponentConfigUseCase(get(), get(), get()) }
    factory { ImportComponentConfigUseCase(get(), get(), get()) }
}
