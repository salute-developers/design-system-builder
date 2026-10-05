package com.dsbuilder.ds.components.di

import com.dsbuilder.ds.components.application.AddStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.AppearanceRepository
import com.dsbuilder.ds.components.application.ComponentModelRepository
import com.dsbuilder.ds.components.application.CreateAppearanceUseCase
import com.dsbuilder.ds.components.application.CreateAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.CreateAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.CreateInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.CreateInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.CreatePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.CreatePropertyUseCase
import com.dsbuilder.ds.components.application.CreatePropertyVariationUseCase
import com.dsbuilder.ds.components.application.CreateStateUseCase
import com.dsbuilder.ds.components.application.CreateStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.CreateStyleCombinationUseCase
import com.dsbuilder.ds.components.application.CreateStyleUseCase
import com.dsbuilder.ds.components.application.CreateVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.CreateVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.CreateVariationUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.DeleteAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.DeleteInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.DeleteInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.DeletePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.DeletePropertyUseCase
import com.dsbuilder.ds.components.application.DeletePropertyVariationUseCase
import com.dsbuilder.ds.components.application.DeleteStateUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.DeleteStyleCombinationUseCase
import com.dsbuilder.ds.components.application.DeleteStyleUseCase
import com.dsbuilder.ds.components.application.DeleteVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.DeleteVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.DeleteVariationUseCase
import com.dsbuilder.ds.components.application.GetAppearanceUseCase
import com.dsbuilder.ds.components.application.GetAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.GetAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.GetInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.GetInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.GetPropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.GetPropertyUseCase
import com.dsbuilder.ds.components.application.GetPropertyVariationUseCase
import com.dsbuilder.ds.components.application.GetStateImpactUseCase
import com.dsbuilder.ds.components.application.GetStateSetUseCase
import com.dsbuilder.ds.components.application.GetStateUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationMemberUseCase
import com.dsbuilder.ds.components.application.GetStyleCombinationUseCase
import com.dsbuilder.ds.components.application.GetStyleUseCase
import com.dsbuilder.ds.components.application.GetVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.GetVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.GetVariationUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationAxesUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationValuesUseCase
import com.dsbuilder.ds.components.application.ListAppearanceVariationsUseCase
import com.dsbuilder.ds.components.application.ListAppearancesUseCase
import com.dsbuilder.ds.components.application.ListInvariantPlatformParamAdjustmentsUseCase
import com.dsbuilder.ds.components.application.ListInvariantPropertyValuesByComponentAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListInvariantPropertyValuesUseCase
import com.dsbuilder.ds.components.application.ListMembersByStyleCombinationUseCase
import com.dsbuilder.ds.components.application.ListPropertiesUseCase
import com.dsbuilder.ds.components.application.ListPropertyPlatformParamsUseCase
import com.dsbuilder.ds.components.application.ListPropertyVariationsUseCase
import com.dsbuilder.ds.components.application.ListStateSetsUseCase
import com.dsbuilder.ds.components.application.ListStatesUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationMembersUseCase
import com.dsbuilder.ds.components.application.ListStyleCombinationsUseCase
import com.dsbuilder.ds.components.application.ListStylesByVariationAndDesignSystemUseCase
import com.dsbuilder.ds.components.application.ListStylesUseCase
import com.dsbuilder.ds.components.application.ListVariationPlatformParamAdjustmentsUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertiesUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesByAppearanceUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesByStyleUseCase
import com.dsbuilder.ds.components.application.ListVariationPropertyValuesUseCase
import com.dsbuilder.ds.components.application.ListVariationStylesUseCase
import com.dsbuilder.ds.components.application.ListVariationsUseCase
import com.dsbuilder.ds.components.application.PropertyValueRepository
import com.dsbuilder.ds.components.application.ResolveStateSetUseCase
import com.dsbuilder.ds.components.application.StateRepository
import com.dsbuilder.ds.components.application.StyleCombinationRepository
import com.dsbuilder.ds.components.application.StyleRepository
import com.dsbuilder.ds.components.application.UpdateAppearanceUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceVariationUseCase
import com.dsbuilder.ds.components.application.UpdateAppearanceVariationValueUseCase
import com.dsbuilder.ds.components.application.UpdateInvariantPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.UpdateInvariantPropertyValueUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyPlatformParamUseCase
import com.dsbuilder.ds.components.application.UpdatePropertyUseCase
import com.dsbuilder.ds.components.application.UpdateStateUseCase
import com.dsbuilder.ds.components.application.UpdateStyleCombinationUseCase
import com.dsbuilder.ds.components.application.UpdateStyleUseCase
import com.dsbuilder.ds.components.application.UpdateVariationPlatformParamAdjustmentUseCase
import com.dsbuilder.ds.components.application.UpdateVariationPropertyValueUseCase
import com.dsbuilder.ds.components.application.UpdateVariationUseCase
import com.dsbuilder.ds.components.data.ExposedAppearanceRepository
import com.dsbuilder.ds.components.data.ExposedComponentModelRepository
import com.dsbuilder.ds.components.data.ExposedPropertyValueRepository
import com.dsbuilder.ds.components.data.ExposedStateRepository
import com.dsbuilder.ds.components.data.ExposedStyleCombinationRepository
import com.dsbuilder.ds.components.data.ExposedStyleRepository
import org.koin.dsl.module

/** Dependency bindings for the component variation and property model. */
val componentModelModule = module {
    single<ComponentModelRepository> { ExposedComponentModelRepository() }
    single<AppearanceRepository> { ExposedAppearanceRepository() }
    single<StyleRepository> { ExposedStyleRepository() }
    single<PropertyValueRepository> { ExposedPropertyValueRepository() }
    single<StateRepository> { ExposedStateRepository() }
    single<StyleCombinationRepository> { ExposedStyleCombinationRepository() }
    factory { ListVariationsUseCase(get(), get(), get()) }
    factory { GetVariationUseCase(get(), get(), get()) }
    factory { CreateVariationUseCase(get(), get(), get()) }
    factory { UpdateVariationUseCase(get(), get(), get()) }
    factory { DeleteVariationUseCase(get(), get(), get()) }
    factory { ListVariationStylesUseCase(get(), get(), get()) }
    factory { ListVariationPropertiesUseCase(get(), get(), get()) }
    factory { ListPropertiesUseCase(get(), get(), get()) }
    factory { GetPropertyUseCase(get(), get(), get()) }
    factory { CreatePropertyUseCase(get(), get(), get()) }
    factory { UpdatePropertyUseCase(get(), get(), get()) }
    factory { DeletePropertyUseCase(get(), get(), get()) }
    factory { ListPropertyPlatformParamsUseCase(get(), get(), get()) }
    factory { GetPropertyPlatformParamUseCase(get(), get(), get()) }
    factory { CreatePropertyPlatformParamUseCase(get(), get(), get()) }
    factory { UpdatePropertyPlatformParamUseCase(get(), get(), get()) }
    factory { DeletePropertyPlatformParamUseCase(get(), get(), get()) }
    factory { ListPropertyVariationsUseCase(get(), get(), get()) }
    factory { GetPropertyVariationUseCase(get(), get(), get()) }
    factory { CreatePropertyVariationUseCase(get(), get(), get()) }
    factory { DeletePropertyVariationUseCase(get(), get(), get()) }
    factory { ListVariationPlatformParamAdjustmentsUseCase(get(), get(), get()) }
    factory { GetVariationPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { CreateVariationPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { UpdateVariationPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { DeleteVariationPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { ListInvariantPlatformParamAdjustmentsUseCase(get(), get(), get()) }
    factory { GetInvariantPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { CreateInvariantPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { UpdateInvariantPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { DeleteInvariantPlatformParamAdjustmentUseCase(get(), get(), get()) }
    factory { ListStylesUseCase(get(), get(), get()) }
    factory { GetStyleUseCase(get(), get(), get()) }
    factory { ListStylesByVariationAndDesignSystemUseCase(get(), get(), get()) }
    factory { CreateStyleUseCase(get(), get(), get()) }
    factory { UpdateStyleUseCase(get(), get(), get()) }
    factory { DeleteStyleUseCase(get(), get(), get()) }
    factory { ListAppearancesUseCase(get(), get(), get()) }
    factory { GetAppearanceUseCase(get(), get(), get()) }
    factory { CreateAppearanceUseCase(get(), get(), get()) }
    factory { UpdateAppearanceUseCase(get(), get(), get()) }
    factory { DeleteAppearanceUseCase(get(), get(), get()) }
    factory { ListAppearanceVariationAxesUseCase(get(), get(), get()) }
    factory { ListAppearanceVariationsUseCase(get(), get(), get()) }
    factory { GetAppearanceVariationUseCase(get(), get(), get()) }
    factory { CreateAppearanceVariationUseCase(get(), get(), get()) }
    factory { UpdateAppearanceVariationUseCase(get(), get(), get()) }
    factory { DeleteAppearanceVariationUseCase(get(), get(), get()) }
    factory { ListAppearanceVariationValuesUseCase(get(), get(), get()) }
    factory { GetAppearanceVariationValueUseCase(get(), get(), get()) }
    factory { CreateAppearanceVariationValueUseCase(get(), get(), get()) }
    factory { UpdateAppearanceVariationValueUseCase(get(), get(), get()) }
    factory { DeleteAppearanceVariationValueUseCase(get(), get(), get()) }
    factory { ListVariationPropertyValuesUseCase(get(), get(), get()) }
    factory { GetVariationPropertyValueUseCase(get(), get(), get()) }
    factory { ListVariationPropertyValuesByStyleUseCase(get(), get(), get()) }
    factory { ListVariationPropertyValuesByAppearanceUseCase(get(), get(), get()) }
    factory { CreateVariationPropertyValueUseCase(get(), get(), get()) }
    factory { UpdateVariationPropertyValueUseCase(get(), get(), get()) }
    factory { DeleteVariationPropertyValueUseCase(get(), get(), get()) }
    factory { ListInvariantPropertyValuesUseCase(get(), get(), get()) }
    factory { GetInvariantPropertyValueUseCase(get(), get(), get()) }
    factory { ListInvariantPropertyValuesByComponentAndDesignSystemUseCase(get(), get(), get()) }
    factory { CreateInvariantPropertyValueUseCase(get(), get(), get()) }
    factory { UpdateInvariantPropertyValueUseCase(get(), get(), get()) }
    factory { DeleteInvariantPropertyValueUseCase(get(), get(), get()) }
    factory { ListStatesUseCase(get(), get(), get()) }
    factory { GetStateUseCase(get(), get(), get()) }
    factory { GetStateImpactUseCase(get(), get(), get()) }
    factory { CreateStateUseCase(get(), get(), get()) }
    factory { UpdateStateUseCase(get(), get(), get()) }
    factory { DeleteStateUseCase(get(), get(), get()) }
    factory { ListStateSetsUseCase(get(), get(), get()) }
    factory { GetStateSetUseCase(get(), get(), get()) }
    factory { ResolveStateSetUseCase(get(), get(), get()) }
    factory { ListStyleCombinationsUseCase(get(), get(), get()) }
    factory { GetStyleCombinationUseCase(get(), get(), get()) }
    factory { CreateStyleCombinationUseCase(get(), get(), get()) }
    factory { UpdateStyleCombinationUseCase(get(), get(), get()) }
    factory { DeleteStyleCombinationUseCase(get(), get(), get()) }
    factory { ListMembersByStyleCombinationUseCase(get(), get(), get()) }
    factory { AddStyleCombinationMemberUseCase(get(), get(), get()) }
    factory { ListStyleCombinationMembersUseCase(get(), get(), get()) }
    factory { GetStyleCombinationMemberUseCase(get(), get(), get()) }
    factory { CreateStyleCombinationMemberUseCase(get(), get(), get()) }
    factory { DeleteStyleCombinationMemberUseCase(get(), get(), get()) }
}
