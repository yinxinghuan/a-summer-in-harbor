% Only generated, validated rule modules; no user goals or file paths in JSON.
:- use_module(library(http/json)).
:- initialization(main, main).
main([UtilPath, RulePath, ModuleName]) :-
    (UtilPath == '-' -> true ; use_module(UtilPath, [])), use_module(RulePath, []),
    atom_string(Module, ModuleName), module_property(Module, file(LoadedPath)),
    same_file(LoadedPath, RulePath),
    json_read_dict(user_input, Input),
    maplist(resolve_case(Module), Input.cases, Results),
    json_write_dict(current_output, _{results:Results}), nl.
resolve_case(Module, Input, Result) :-
    atomics_to_string(Parts, '-', Input.action_id), atomic_list_concat(Parts, '_', Action),
    ( current_predicate(Module:evaluate_state/3) -> Module:evaluate_state(Action, Input.state, Result) ;
    setup_call_cleanup(
        Module:hydrate_game_state(service_session, service_actor, Input.state),
        (Module:game_action(service_session, service_actor, Action, Reply),
         (Reply.accepted == true -> Module:game_rule_effects(Action, Effects) ; Effects = [])),
        util:clear_session(service_session)),
    Result = _{accepted:Reply.accepted,effects:Effects}).
